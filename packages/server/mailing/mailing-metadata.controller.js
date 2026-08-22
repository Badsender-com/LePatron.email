'use strict';

const asyncHandler = require('express-async-handler');

const mailingService = require('./mailing.service.js');
const mailingMetadataService = require('./mailing-metadata.service.js');

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
 * @apiParam (Body) {String} [plannedSendDate] ISO date, `null` to clear
 * @apiParam (Body) {String} [_emailType] a taxonomy item of the same company,
 *   `null` to detach
 *
 * @apiSuccess {String} id
 * @apiSuccess {String} subject
 * @apiSuccess {Date} plannedSendDate
 * @apiSuccess {String} emailTypeId
 *
 * @apiDescription Only the three fields above are accepted; any other key in the
 *   body is a 422 `INVALID_EMAIL_METADATA`, so a caller is never silently ignored.
 *
 *   The preheader is NOT part of this endpoint — `{"preheader": "..."}` is refused.
 *   It is a template property, edited where it always has been (the template's own
 *   options in the editor) and persisted with the email. Wiring it through here
 *   would mean changing how our templates declare it, which is a product question
 *   still to be settled.
 */

async function updateMetadata(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  // Tenant-scoped read, and a 404 rather than a CastError on a malformed id.
  const mailing = await mailingService.findOneForUser(mailingId, user);
  await mailingService.assertUserCanEditMailing(user, mailing);

  await mailingMetadataService.applyMetadataToMailing(mailing, req.body);

  await mailing.save();

  // Only the fields this endpoint owns: `mailing.toJSON()` would carry `data` and
  // `previewHtml`, the very blobs the rest of the read paths take pains to strip.
  res.json({
    id: mailing.id,
    subject: mailing.subject,
    plannedSendDate: mailing.plannedSendDate,
    emailTypeId: mailing._emailType,
    updatedAt: mailing.updatedAt,
  });
}
