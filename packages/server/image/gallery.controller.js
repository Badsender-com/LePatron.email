'use strict';

// The gallery of a mailing or a template, as the editor reads and writes it:
// the list, the rename of a label, the uploads. Serving and resizing the
// images themselves stays in image.controller.js.

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const fileManager = require('../common/file-manage.service.js');
const imageService = require('./image.service');
const mailingService = require('../mailing/mailing.service.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');
const {
  sanitizeLabel,
  MAX_LABEL_LENGTH,
} = require('../../shared/gallery/label.js');

module.exports = {
  list: asyncHandler(list),
  updateLabel: asyncHandler(updateLabel),
  create: asyncHandler(create),
  createFromUrl: asyncHandler(createFromUrl),
};

/**
 * @api {get} /images/gallery/:mailingOrTemplateId gallery images list
 * @apiPermission public
 * @apiName GetGalleryImages
 * @apiGroup Images
 *
 * @apiParam {string} mailingOrTemplateId
 *
 * @apiUse galleryImages
 *
 */

// Those functions are accessible only from the editor
// wireframes assets (preview & template fixed assets)…
// …are handled separately in wireframes.js#update
async function list(req, res) {
  const { mongoId } = req.params;

  // The whole gallery: the editor searches, filters and sorts it itself,
  // with packages/shared/gallery/filter.js.
  const gallery = await imageService.findOrCreateGallery(mongoId);
  res.json({ files: gallery.files });
}

/**
 * @api {patch} /images/gallery/:mailingOrTemplateId/:imageName/label rename an image label
 * @apiPermission user
 * @apiName PatchGalleryImageLabel
 * @apiGroup Images
 *
 * @apiParam {string} mailingOrTemplateId
 * @apiParam {string} imageName
 * @apiParam (Body) {String} label The new label, 1 to 255 characters
 *
 */

// the technical file name never changes: only the label the user reads
async function updateLabel(req, res) {
  const { mongoId, imageName } = req.params;
  const { label } = req.body;

  if (typeof label === 'string' && label.length > MAX_LABEL_LENGTH) {
    throw new createError.BadRequest(ERROR_CODES.LABEL_TOO_LONG);
  }
  // the same cleanup an upload goes through, so one path cannot store a label
  // the other would refuse
  const cleanLabel = sanitizeLabel(label);
  if (!cleanLabel) {
    throw new createError.BadRequest(ERROR_CODES.LABEL_NOT_PROVIDED);
  }

  // the imageName is technically prefixed by its gallery's mongoId: enforce the
  // match so a caller can't target an image outside the gallery in the URL
  if (!imageName.startsWith(`${mongoId}-`)) {
    throw new createError.UnprocessableEntity(ERROR_CODES.INVALID_IMAGE_NAME);
  }

  // renaming writes in the gallery's parent: the same scope as editing it
  await imageService.assertCanEditGallery(req.user, mongoId);

  const gallery = await imageService.renameLabel(
    mongoId,
    imageName,
    cleanLabel
  );
  const file = gallery.files.find((f) => f.name === imageName);
  res.json(file);
}

/**
 * @api {post} /images/gallery/:mailingOrTemplateId gallery images upload
 * @apiPermission public
 * @apiName PostGalleryImages
 * @apiGroup Images
 *
 * @apiParam {string} mailingOrTemplateId
 *
 * @apiUse galleryImages
 *
 */

// upload & update gallery
async function create(req, res) {
  const { mongoId } = req.params;
  const multipartOptions = {
    prefix: mongoId,
    formatter: 'editor',
  };
  const files = await imageService.storeInGallery(mongoId, async () => {
    const uploads = await fileManager.parseMultipart(req, multipartOptions);
    return uploads.files;
  });

  // Only the new uploads, as the gallery holds them, label included: the
  // editor pushes these very objects into its gallery list, and a response
  // without the V1 fields showed the fresh thumbnail's technical file name
  // until the next reload.
  res.json({ files });
}

/**
 * @api {post} /images/gallery/:mongoId/from-url download an external image into the gallery
 * @apiPermission user
 * @apiName PostGalleryImageFromUrl
 * @apiGroup Images
 *
 * @apiParam {string} mongoId
 * @apiParam (Body) {String} url External image URL to download
 *
 * @apiUse galleryImages
 */
async function createFromUrl(req, res) {
  const { mongoId } = req.params;
  const { url: imageUrl } = req.body;

  if (!imageUrl) {
    throw new createError.BadRequest('url is required');
  }

  // Authorize the target gallery before doing anything else. `mongoId` is a
  // mailing id (the content-feed modal always passes currentMailing().id):
  // findOneForUser validates the ObjectId format — so a crafted value can't
  // reach the filename builder in image.service — and enforces group
  // ownership, so a user can't write into another group's gallery. Throws
  // NotFound on both invalid and cross-tenant ids.
  await mailingService.findOneForUser(mongoId, req.user);

  let uploadedFile;
  try {
    uploadedFile = await imageService.createFromUrl(mongoId, imageUrl);
  } catch (error) {
    // Log the real cause server-side, but return a generic message: the
    // upstream fetch error would otherwise leak internal reachability info
    // (SSRF oracle) — connection refused vs 404 vs timeout on a probed host.
    logger.error('Failed to download image from url', imageUrl, error.message);
    throw new createError.BadGateway(ERROR_CODES.IMAGE_DOWNLOAD_FAILED);
  }

  res.json({ files: [uploadedFile] });
}
