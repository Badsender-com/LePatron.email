'use strict';

const crypto = require('crypto');
const { PassThrough } = require('stream');
const mime = require('mime-types');
const fetch = require('node-fetch');
const AbortController = require('abort-controller');

const { Galleries } = require('../common/models.common.js');
const fileManager = require('../common/file-manage.service.js');
const formatName = require('../helpers/format-filename-for-jquery-fileupload.js');
const { assertOutboundHostAllowed } = require('../utils/outbound-host.js');
const logger = require('../utils/logger.js');

const DOWNLOAD_TIMEOUT_MS = 15000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function destroy(mongoId, imageName) {
  return Galleries.findOne({
    creationOrWireframeId: mongoId,
  }).then((gallery) => {
    // TODO: handle non existing gallery
    // mongoID could be incorrect

    const { files } = gallery;

    const imageIndex = files.findIndex((file) => file.name === imageName);

    const filesUpdated = files;

    filesUpdated.splice(imageIndex, 1);

    gallery.files = filesUpdated;

    gallery.markModified('files');
    return gallery.save();
  });
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

  const gallery =
    (await Galleries.findOne({ creationOrWireframeId: mongoId })) ||
    (await createGallery(mongoId));

  const alreadyStored = gallery.files.some((file) => file.name === fileName);
  if (!alreadyStored) {
    gallery.files = [...gallery.files, uploadedFile];
    gallery.markModified('files');
    await gallery.save();
  }

  logger.log('Downloaded feed image into gallery', mongoId, fileName);

  return uploadedFile;
}

module.exports = {
  destroy,
  createGallery,
  createFromUrl,
};
