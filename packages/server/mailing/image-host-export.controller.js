'use strict';

const asyncHandler = require('express-async-handler');
const archiver = require('archiver');
const {
  startImageHostExport,
  getImageHostExport,
  getImageHostExportResult,
} = require('./image-host-export-jobs.js');

module.exports = {
  start: asyncHandler(start),
  status: asyncHandler(status),
  zip: asyncHandler(zip),
};

/**
 * @api {post} /mailings/:mailingId/mosaico/image-host-exports Export to an image host
 * @apiPermission mailing.export
 * @apiName StartImageHostExport
 * @apiGroup Mailings
 * @apiDescription Checks the export at once and answers 202 with the job that
 * puts the images on the image host (ADR 0029).
 *
 * @apiParam {String} mailingId
 * @apiBody {String} html the HTML the editor exports
 * @apiBody {String} hostingIntegrationId an image host of the email's company
 * @apiBody {Object} [tracking] the tracking typed in the editor
 *
 * @apiSuccess (202) {String} jobId
 */
async function start(req, res) {
  const { user, params, body } = req;
  const { jobId } = await startImageHostExport({
    mailingId: params.mailingId,
    html: body.html,
    user,
    hostingIntegrationId: body.hostingIntegrationId,
    freshTracking: body.tracking,
  });
  res.status(202).json({ jobId });
}

/**
 * @api {get} /mailings/image-host-exports/:jobId An export to an image host
 * @apiPermission mailing.export, the user who started it
 * @apiName GetImageHostExport
 * @apiGroup Mailings
 *
 * @apiSuccess {String} status `hosting`, `completed` or `failed`
 * @apiSuccess {Object} progress `{ done, total }` images
 * @apiSuccess {Object} error `{ code, images }` when failed
 */
async function status(req, res) {
  res.json(
    await getImageHostExport({ jobId: req.params.jobId, user: req.user })
  );
}

/**
 * @api {get} /mailings/image-host-exports/:jobId/zip The ZIP of a completed export
 * @apiPermission mailing.export, the user who started it
 * @apiName GetImageHostExportZip
 * @apiGroup Mailings
 * @apiDescription The HTML alone, every image loaded from the image host.
 */
async function zip(req, res, next) {
  const { prefix, name, html } = await getImageHostExportResult({
    jobId: req.params.jobId,
    user: req.user,
  });
  const archive = archiver('zip');
  archive.on('error', next);
  res.attachment(`${name}.zip`);
  archive.pipe(res);
  archive.append(html, { prefix, name: `${name}.html` });
  await archive.finalize();
}
