'use strict';

// const cheerio = require('cheerio')
const asyncHandler = require('express-async-handler');
const mailingService = require('./mailing.service.js');
const profileService = require('../profile/profile.service.js');
const logger = require('../utils/logger.js');
const archiver = require('archiver');
const { InternalServerError, BadRequest } = require('http-errors');
const { ERROR_CODES } = require('../constant/error-codes.js');
const { ExportProfiles } = require('../common/models.common.js');
const DeliveryMethods = require('../constant/delivery-method.js');

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
  const { html, exportProfileId, ...downloadOptions } = body;

  // Check if this is an export profile with ESP delivery
  if (exportProfileId && exportProfileId !== '' && exportProfileId !== 'null') {
    const exportProfile = await ExportProfiles.findById(exportProfileId).populate('_espProfile');

    if (exportProfile && exportProfile.deliveryMethod === DeliveryMethods.ESP) {
      // Handle ESP delivery
      return handleEspDelivery(req, res, {
        user,
        html,
        mailingId,
        exportProfile,
        downloadOptions: { ...downloadOptions, exportProfileId },
      });
    }
  }

  // Continue with ZIP download (legacy or export profile with download delivery)
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
      downloadOptions: { ...downloadOptions, exportProfileId },
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
    const backUrl = req.header('Referer') || '/';
    res.redirect(backUrl);
  }
}

/**
 * Handle ESP delivery for export profiles
 * This will process images (upload to Asset if needed) and send to ESP
 */
async function handleEspDelivery(req, res, { user, html, mailingId, exportProfile, downloadOptions }) {
  logger.log('Handling ESP delivery for export profile:', exportProfile.id);

  try {
    const espProfile = exportProfile._espProfile;
    if (!espProfile) {
      throw new BadRequest('ESP profile not found in export profile');
    }

    // Get mailing info for campaign name and subject
    const mailing = await mailingService.getMailByMailingIdAndUser({ mailingId, user });
    const mailingName = mailing.name || 'Email Campaign';

    // Prepare ESP sending data from the ESP profile
    // Note: sendEspCampaign expects 'campaignMailName' which it maps to 'name' for the provider
    const espSendingMailData = {
      subject: mailingName,
      campaignMailName: mailingName,
      // Use sender info from ESP profile's additionalApiData
      senderName: espProfile.additionalApiData?.senderName || espProfile.name,
      senderMail: espProfile.additionalApiData?.senderMail || '',
      replyTo: espProfile.additionalApiData?.replyTo || '',
      contentSendType: espProfile.additionalApiData?.contentSendType || 'MAIL',
    };

    // Process HTML with images uploaded to Asset (FTP/S3) if needed
    // The processHtmlWithFTPOption will use the export profile's asset configuration
    const processedHtml = await mailingService.processHtmlWithFTPOption({
      user,
      html,
      mailingId,
      doesWaitForFtp: true,
      downloadOptions,
    });

    // Send to ESP (skipHtmlProcessing=true because we already processed the HTML above)
    const result = await profileService.sendEspCampaign({
      user,
      espSendingMailData,
      profileId: espProfile.id || espProfile._id,
      html: processedHtml,
      mailingId,
      type: espProfile.type,
      skipHtmlProcessing: true,
    });

    logger.log('ESP delivery successful:', result);

    // Return success response (not a file download)
    res.json({
      success: true,
      message: 'Email sent to ESP successfully',
      ...result,
    });
  } catch (error) {
    logger.error('Error during ESP delivery:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Error sending to ESP',
      error: error.response?.data?.message || error.message,
    });
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
}
