'use strict';

const asyncHandler = require('express-async-handler');

const mailingService = require('./mailing.service.js');
const mailingQualityService = require('./mailing-quality.service.js');

module.exports = {
  updateQualityIgnores: asyncHandler(updateQualityIgnores),
};

/**
 * @api {patch} /mailings/:mailingId/quality-ignores ignore a quality finding
 * @apiPermission user
 * @apiName UpdateMailingQualityIgnores
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String} fingerprint the finding's fingerprint, as the
 *   editor's quality engine computes it
 * @apiParam (Body) {String} [ruleId] the check that raised it, kept for audit
 * @apiParam (Body) {Boolean} ignored `true` to ignore it, `false` to stop
 *
 * @apiSuccess {String[]} qualityIgnores the fingerprints ignored on the email
 *
 * @apiDescription Ignoring a finding is shared by everyone who edits the email,
 *   so it takes the same right as editing it. Any other key in the body is a
 *   422 `INVALID_QUALITY_IGNORE`.
 */
async function updateQualityIgnores(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  // Validated before any read: a malformed request costs no database access.
  const change = mailingQualityService.validateIgnorePayload(req.body);

  // Tenant-scoped read, and a 404 rather than a CastError on a malformed id.
  const mailing = await mailingService.findOneForUser(mailingId, user);
  await mailingService.assertUserCanEditMailing(user, mailing);

  const qualityIgnores = mailingQualityService.applyIgnore(
    mailing,
    change,
    user
  );
  await mailing.save();

  // Only what this endpoint owns: never `data` or `previewHtml`.
  res.json({ qualityIgnores });
}
