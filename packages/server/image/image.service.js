'use strict';

const crypto = require('crypto');
const { PassThrough } = require('stream');
const mime = require('mime-types');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');
const createError = require('http-errors');

const { Galleries } = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const { assertOutboundHostAllowed } = require('../utils/outbound-host.js');
const logger = require('../utils/logger.js');

const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const DUPLICATE_KEY_ERROR = 11000;

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

// Append the files the gallery doesn't list yet. The name filter makes the
// "already there?" check part of the same atomic update as the push.
async function addFiles(mongoId, files) {
  await findOrCreateGallery(mongoId);
  await Promise.all(
    files.map((file) =>
      Galleries.updateOne(
        { creationOrWireframeId: mongoId, 'files.name': { $ne: file.name } },
        { $push: { files: file } }
      )
    )
  );
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

  await addFiles(mongoId, [uploadedFile]);

  logger.log('Downloaded feed image into gallery', mongoId, fileName);

  return uploadedFile;
}

module.exports = {
  destroy,
  createGallery,
  findOrCreateGallery,
  addFiles,
  createFromUrl,
};
