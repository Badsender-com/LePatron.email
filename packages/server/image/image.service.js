'use strict';

const crypto = require('crypto');
const { PassThrough } = require('stream');
const mime = require('mime-types');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const createError = require('http-errors');

const {
  Galleries,
  Mailings,
  Templates,
} = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');
const uploadIdentity = require('../common/upload-identity.service.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const { assertOutboundHostAllowed } = require('../utils/outbound-host.js');
const modelsUtils = require('../utils/model.js');
const mailingService = require('../mailing/mailing.service.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const { labelForUpload } = require('../../shared/gallery/label.js');

const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DUPLICATE_KEY_ERROR = 11000;

// A gallery carries no company of its own: it belongs to the mailing or the
// template whose id it bears (creationOrWireframeId), and writing in it is
// writing in that parent. The gallery of an email follows the email's write
// scope, the same check as saving the email (its workspace, or the workspace
// of its folder). The gallery of a template follows the rule for editing a
// template (PUT /templates/:id): platform.manage.
//
// Every refusal is the same Forbidden, a missing parent included, so the
// answer says nothing about what exists in another group or workspace.
async function assertCanEditGallery(user, creationOrWireframeId) {
  const query = modelsUtils.addGroupFilter(user, {
    _id: creationOrWireframeId,
  });
  const [mailing, template] = await Promise.all([
    Mailings.findOne(query, '_id _workspace _parentFolder'),
    Templates.findOne(query, '_id'),
  ]);
  const allowed = mailing
    ? await mailingService.userCanEditMailing(user, mailing)
    : !!template && permissions.can(user, CAPABILITIES.PLATFORM_MANAGE);
  if (!allowed) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
  }
}

// Like every other write here, a single atomic update: the positional operator
// renames the matched file in place, so a concurrent upload can't be lost.
// Only the renamed file is sent back: the whole gallery, thousands of images
// for some, made a rename five times slower for one line of response. The
// positional projection would be shorter, but MongoDB refuses it alongside
// `new: true`.
async function renameLabel(mongoId, imageName, newLabel) {
  const gallery = await Galleries.findOneAndUpdate(
    { creationOrWireframeId: mongoId, 'files.name': imageName },
    { $set: { 'files.$.label': newLabel } },
    { new: true, projection: { files: { $elemMatch: { name: imageName } } } }
  );
  if (gallery) return gallery;

  // nothing matched: tell "no such gallery" apart from "no such image in it"
  const exists = await Galleries.exists({ creationOrWireframeId: mongoId });
  throw new createError.NotFound(
    exists ? ERROR_CODES.GALLERY_IMAGE_NOT_FOUND : ERROR_CODES.GALLERY_NOT_FOUND
  );
}

// Every write below is a single atomic update. Reading the gallery, changing
// its `files` and saving it back lost images: two uploads validated one after
// the other overlap on the server (each waits for S3), the second save carries
// a stale version and Mongoose refuses it with a VersionError. The image was
// stored but never listed, and the editor showed an upload error.
async function destroy(mongoId, imageName) {
  const gallery = await Galleries.findOneAndUpdate(
    { creationOrWireframeId: mongoId },
    { $pull: { files: { name: imageName } } },
    { new: true }
  );
  if (!gallery) throw new createError.NotFound();
  return gallery;
}

// Seeded from the storage listing, in the V1 shape: a gallery created after
// the V1 migration has run will never be migrated. The storage gives no
// upload date, so the images date from the gallery, as the migration does it.
// `except` names files being added right now: they are pushed with what their
// upload knows (label, dimensions), which a seed from the listing would lose.
function createGallery(mongoId, { except = [] } = {}) {
  return fileManager.list(mongoId).then((files) => {
    return new Galleries({
      creationOrWireframeId: mongoId,
      files: files
        .filter((file) => !except.includes(file.name))
        .map(toGalleryFile),
    }).save();
  });
}

// A gallery is created on first use, seeded from the storage listing. Several
// requests can need it at once (the first uploads of a creation, or an upload
// while the gallery panel opens): the unique index lets one create it, and the
// others read the one it created.
async function findOrCreateGallery(mongoId, options) {
  const gallery = await Galleries.findOne({ creationOrWireframeId: mongoId });
  if (gallery) return gallery;
  try {
    return await createGallery(mongoId, options);
  } catch (error) {
    if (error.code !== DUPLICATE_KEY_ERROR) throw error;
    return Galleries.findOne({ creationOrWireframeId: mongoId });
  }
}

// A gallery image carries more than the uploader returns: the V1 fields of
// US-01. Build them in one place, so a stored document and the response that
// announces it can never describe the same image differently.
function toGalleryFile(file) {
  // `uploadedName` only exists to seed the label; it would be a second, stale
  // copy of it in the document, so it does not get stored.
  const { uploadedName, ...stored } = file;
  return {
    ...stored,
    label: labelForUpload(file.name, uploadedName || file.originalName),
    source: 'upload',
    externalMetadata: {},
    uploadedAt: new Date(),
  };
}

// One image as the gallery holds it, through the same getter as the list.
async function readGalleryFile(mongoId, name) {
  const gallery = await Galleries.findOne(
    { creationOrWireframeId: mongoId },
    { files: { $elemMatch: { name } } }
  );
  const [file] = gallery ? gallery.files : [];
  if (!file) {
    throw new createError.NotFound(ERROR_CODES.GALLERY_IMAGE_NOT_FOUND);
  }
  return file;
}

// Append the files the gallery doesn't list yet. The name filter makes the
// "already there?" check part of the same atomic update as the push. Answers
// with each file as the gallery holds it, read back: when the push was
// skipped (the same bytes uploaded again), that is the entry already there,
// not what this upload would have stored.
async function addFiles(mongoId, files) {
  await findOrCreateGallery(mongoId, { except: files.map((f) => f.name) });
  return Promise.all(
    files.map(async (file) => {
      await Galleries.updateOne(
        { creationOrWireframeId: mongoId, 'files.name': { $ne: file.name } },
        { $push: { files: toGalleryFile(file) } }
      );
      return readGalleryFile(mongoId, file.name);
    })
  );
}

// Store new images and list them. The gallery is created BEFORE the bytes
// reach the storage: a gallery is seeded from the storage listing, and a
// listing taken after another request has written its file would seed that
// file under its technical name, without dimensions, and skip its own push.
async function storeInGallery(mongoId, writeFiles) {
  await findOrCreateGallery(mongoId);
  const files = await writeFiles();
  return addFiles(mongoId, files);
}

/**
 * Download an external image and store it through the same pipeline as a
 * normal gallery upload (naming convention, storage backend, Gallery
 * document), so the result is a `{ name, url, deleteUrl, thumbnailUrl }`
 * object usable exactly like a manually-uploaded file — e.g. as the value
 * for a Mosaico block's `imageOptions.src`, which the app's own image-resize
 * proxy can only resolve for files it has actually stored itself.
 *
 * @param {string} mongoId The mailing (or template) id this image belongs to
 * @param {string} imageUrl The external image URL to download
 * @returns {Promise<{name: string, url: string, deleteUrl: string, thumbnailUrl: string}>}
 */
async function createFromUrl(mongoId, imageUrl) {
  // SSRF guard — see integration-providers for the same rule applied to
  // feed URLs; this is a second untrusted URL (an item's image link).
  await assertOutboundHostAllowed(imageUrl);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS);

  let buffer;
  let contentType;
  try {
    const response = await fetch(imageUrl, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Image download failed with status ${response.status}`);
    }
    contentType = response.headers.get('content-type');
    buffer = await response.buffer();
  } finally {
    clearTimeout(timeoutId);
  }

  if (buffer.length === 0) {
    throw new Error('Downloaded image is empty');
  }
  if (buffer.length > MAX_IMAGE_BYTES) {
    throw new Error('Downloaded image exceeds the maximum allowed size');
  }

  const ext = mime.extension(contentType) || 'jpg';
  const hash = crypto.createHash('md5').update(buffer).digest('hex');
  const fileName = `${mongoId}-${hash}.${ext}`;

  const [storedFile] = await storeInGallery(mongoId, async () => {
    const source = new PassThrough();
    source.end(buffer);
    await fileManager.writeStreamFromStream(source, fileName);

    const uploadedFile = formatName(fileName);
    // The gallery tooltip shows the original dimensions, and this path never
    // goes through the upload parser that captures them. Through the shared
    // reader, which hands the prober only a bounded prefix of the buffer.
    const dimensions = uploadIdentity.probeImageDimensions(buffer);
    if (dimensions) {
      uploadedFile.width = dimensions.width;
      uploadedFile.height = dimensions.height;
    }
    return [uploadedFile];
  });

  logger.log('Downloaded feed image into gallery', mongoId, fileName);

  return storedFile;
}

module.exports = {
  destroy,
  createGallery,
  findOrCreateGallery,
  addFiles,
  storeInGallery,
  createFromUrl,
  renameLabel,
  assertCanEditGallery,
};
