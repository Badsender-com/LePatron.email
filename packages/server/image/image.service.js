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
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const { assertOutboundHostAllowed } = require('../utils/outbound-host.js');
const modelsUtils = require('../utils/model.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const { filterGalleryFiles } = require('../../shared/gallery/filter.js');
const { labelForUpload } = require('../../shared/gallery/label.js');

const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DUPLICATE_KEY_ERROR = 11000;

// a gallery is owned by its parent mailing or template (creationOrWireframeId);
// galleries themselves carry no _company, so authorization is delegated to the
// parent. Throws Forbidden if the parent doesn't belong to the user's group.
async function assertGalleryOwnership(user, creationOrWireframeId) {
  const query = modelsUtils.addGroupFilter(user, {
    _id: creationOrWireframeId,
  });
  const [mailing, template] = await Promise.all([
    Mailings.findOne(query, '_id'),
    Templates.findOne(query, '_id'),
  ]);
  if (!mailing && !template) {
    throw new createError.Forbidden(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
  }
}

// Like every other write here, a single atomic update: the positional operator
// renames the matched file in place, so a concurrent upload can't be lost.
async function renameLabel(mongoId, imageName, newLabel) {
  const gallery = await Galleries.findOneAndUpdate(
    { creationOrWireframeId: mongoId, 'files.name': imageName },
    { $set: { 'files.$.label': newLabel } },
    { new: true }
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

function createGallery(mongoId) {
  // create the gallery in DB
  return fileManager.list(mongoId).then((files) => {
    return new Galleries({
      creationOrWireframeId: mongoId,
      files,
    }).save();
  });
}

// A gallery is created on first use, seeded from the storage listing. Several
// requests can need it at once (the first uploads of a creation, or an upload
// while the gallery panel opens): the unique index lets one create it, and the
// others read the one it created.
async function findOrCreateGallery(mongoId) {
  const gallery = await Galleries.findOne({ creationOrWireframeId: mongoId });
  if (gallery) return gallery;
  try {
    return await createGallery(mongoId);
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

// Append the files the gallery doesn't list yet. The name filter makes the
// "already there?" check part of the same atomic update as the push. Returns
// what was stored, so the caller can answer with it rather than with the
// thinner object the upload parser produced.
async function addFiles(mongoId, files) {
  await findOrCreateGallery(mongoId);
  const galleryFiles = files.map(toGalleryFile);
  await Promise.all(
    galleryFiles.map((file) =>
      Galleries.updateOne(
        { creationOrWireframeId: mongoId, 'files.name': { $ne: file.name } },
        { $push: { files: file } }
      )
    )
  );
  return galleryFiles;
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

  const source = new PassThrough();
  source.end(buffer);
  await fileManager.writeStreamFromStream(source, fileName);

  const uploadedFile = formatName(fileName);

  const [storedFile] = await addFiles(mongoId, [uploadedFile]);

  logger.log('Downloaded feed image into gallery', mongoId, fileName);

  return storedFile;
}

module.exports = {
  destroy,
  createGallery,
  findOrCreateGallery,
  addFiles,
  toGalleryFile,
  createFromUrl,
  filterGalleryFiles,
  renameLabel,
  assertGalleryOwnership,
};
