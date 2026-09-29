'use strict';

const asyncHandler = require('express-async-handler');

const config = require('../node.config.js');
const mailingService = require('./mailing.service.js');
const mailingQualityService = require('./mailing-quality.service.js');
const qualityResourcesService = require('./quality-resources.service.js');

module.exports = {
  updateQualityIgnores: asyncHandler(updateQualityIgnores),
  checkResources: asyncHandler(checkResources),
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

/**
 * @api {post} /mailings/:mailingId/quality/resources check links and images
 * @apiPermission user
 * @apiName CheckMailingQualityResources
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiParam (Body) {String[]} links http(s) addresses of the client's links
 *   (60 at most)
 * @apiParam (Body) {Object[]} images `{ url }` of the client's images
 *   (40 at most)
 *
 * @apiSuccess {Object} links by address: `{ state: ok|broken|unverifiable,
 *   httpStatus?, reason? }`
 * @apiSuccess {Object} images by address: `{ state: ok|unreachable|unverifiable,
 *   bytes, width, height, type, atLeast? }`, as the export will ship them
 * @apiSuccess {Object} blocklists `{ enabled, listed: { domain: [names] } }`
 *
 * @apiDescription Reading the email is enough: nothing is stored. One run at a
 *   time per user (429 `QUALITY_CHECK_RUNNING`) and 20 per 10 minutes (429
 *   `QUALITY_CHECKS_TOO_FREQUENT`); anything else in the body, or too many
 *   addresses, is a 422 `INVALID_QUALITY_RESOURCES`.
 */
async function checkResources(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  const resources = qualityResourcesService.validateResourcesPayload(req.body);
  // Tenant-scoped: only someone who can open the email has it checked.
  const mailing = await mailingService.findOneForUser(mailingId, user);

  const result = await qualityResourcesService.checkResources(resources, {
    userKey: String(user.id || user._id || 'admin'),
    cacheScope: String(mailing._company || 'admin'),
    // The editor builds image URLs from the page it runs on; the configured
    // host covers a proxy that rewrites Host.
    ownHosts: [req.get('host'), config.host].filter(Boolean),
  });
  res.json(result);
}
