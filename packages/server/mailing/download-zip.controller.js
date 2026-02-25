'use strict';

// const cheerio = require('cheerio')
const asyncHandler = require('express-async-handler');
const mailingService = require('./mailing.service.js');
const logger = require('../utils/logger.js');
const archiver = require('archiver');
const { InternalServerError } = require('http-errors');
const { ERROR_CODES } = require('../constant/error-codes.js');

module.exports = {
  downloadZip: asyncHandler(downloadZip),
  downloadMultipleZip: asyncHandler(downloadMultipleZip),
};

// eslint-disable-next-line no-unused-vars
function isHttpUrl(uri) {
  return /^http/.test(uri);
}

/**
 * @api {post} /mailings/:mailingId/mosaico/download-zip mailing download
 * @apiPermission user
 * @apiName DownloadMailing
 * @apiDescription Zip format options are configured in the group
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} html the HTML output get in mosaico by `viewModel.exportHTML()`
 * @apiParam (Body) {Boolean} downLoadForCdn wether or not images should point to a CDN<br> Depends on group configuration
 *
 */

// for doc see:
// https://github.com/archiverjs/node-archiver/blob/master/examples/express.js
// we need to keep the `next` callback to handle zip events
async function downloadZip(req, res, next) {
  logger.log('Calling downloadZip');

  const { user, body } = req;
  const { mailingId } = req.params;
  const { html, ...downloadOptions } = body;
  const archive = archiver('zip');
  archive.on('error', next);

  try {
    const {
      archive: processedArchive,
      name,
    } = await mailingService.downloadZip({
      user,
      html,
      archive,
      downloadOptions,
      mailingId,
    });

    archive.on('end', () => {
      console.log(`Archive wrote ${archive.pointer()} bytes`);
      res.end();
    });

    res.attachment(`${name}.zip`);

    // on stream closed we can end the request
    archive.pipe(res);

    // this is the streaming magic
    // set the archive name
    processedArchive.finalize();
  } catch (error) {
    console.error('Error while downloading zip', { error });
    return res.status(500).json({ errorCode: error.message });
  }
}

async function downloadMultipleZip(req, res, next) {
  logger.log('Calling downloadMultipleZip');
  const { user, body } = req;
  const { mailingIds, downloadOptions } = body;
  const archive = archiver('zip');
  archive.on('error', next);

  if (!downloadOptions) {
    throw new InternalServerError(ERROR_CODES.MISSING_DOWNLOAD_OPTIONS);
  }

  try {
    const {
      archive: processedArchive,
      name,
    } = await mailingService.downloadMultipleZip({
      user,
      archive,
      mailingIds,
      downloadOptions,
    });
    res.header('Content-Type', 'application/zip');
    res.header('Content-Disposition', `attachment; filename="${name}.zip"`);

    archive.on('end', () => {
      console.log(`Archive wrote ${archive.pointer()} bytes`);
      res.end();
    });
    archive.pipe(res);

    processedArchive.finalize();
  } catch (error) {
    console.error('Error while downloading multiple zip', { error });
    return res.status(500).json({ errorCode: error.message });
  }
}
