'use strict';

const asyncHandler = require('express-async-handler');

const mailingService = require('./mailing.service.js');
const mailingMetadataService = require('./mailing-metadata.service.js');
const { readPreheader } = require('./preheader-resolver.js');

module.exports = {
  updateMetadata: asyncHandler(updateMetadata),
};

/**
 * @api {patch} /mailings/:mailingId/metadata update the editorial metadata
 * @apiPermission user
 * @apiName UpdateMailingMetadata
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} [subject] the email subject line, `null` to clear
 * @apiParam (Body) {String} [preheader] written into the template's own
 *   `preheaderText` property, and ignored when the template declares none
 * @apiParam (Body) {String} [plannedSendDate] ISO date, `null` to clear
 * @apiParam (Body) {String} [_emailType] a taxonomy item of the same company,
 *   `null` to detach
 *
 * @apiSuccess {String} id
 * @apiSuccess {String} subject
 * @apiSuccess {Date} plannedSendDate
 * @apiSuccess {String} emailTypeId
 * @apiSuccess {String} preheader the value now stored in the template property
 * @apiSuccess {Boolean} preheaderWritten false when the template declares none,
 *   so the UI can hide the field
 */

async function updateMetadata(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  // Tenant-scoped read, and a 404 rather than a CastError on a malformed id.
  const mailing = await mailingService.findOneForUser(mailingId, user);
  await mailingService.assertUserCanEditMailing(user, mailing);

  const {
    preheaderWritten,
  } = await mailingMetadataService.applyMetadataToMailing(mailing, req.body);

  await mailing.save();

  // Only the fields this endpoint owns: `mailing.toJSON()` would carry `data` and
  // `previewHtml`, the very blobs the rest of the read paths take pains to strip.
  res.json({
    id: mailing.id,
    subject: mailing.subject,
    plannedSendDate: mailing.plannedSendDate,
    emailTypeId: mailing._emailType,
    preheader: readPreheader(mailing.data),
    preheaderWritten,
    updatedAt: mailing.updatedAt,
  });
}
