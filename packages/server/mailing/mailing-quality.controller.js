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
 *   editor's quality engine computes it (the check that raised it opens it)
 * @apiParam (Body) {Boolean} ignored `true` to ignore it, `false` to stop
 *
 * @apiSuccess {String[]} qualityIgnores the fingerprints ignored on the email
 *
 * @apiDescription Ignoring a finding is shared by everyone who works on the
 *   email: it takes its own capability (`mailing.ignore-quality`, which a
 *   writer and a reviewer do not hold, 403 `FORBIDDEN_CAPABILITY`) and the
 *   right to write where the email lives. Any other key in the body is a 422
 *   `INVALID_QUALITY_IGNORE`.
 */
async function updateQualityIgnores(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  // Validated before any read: a malformed request costs no database access.
  const change = mailingQualityService.validateIgnorePayload(req.body);

  // Tenant-scoped read of what the right needs (never the content), and a
  // 404 rather than a CastError on a malformed id.
  const mailing = await mailingService.findOneForUser(
    mailingId,
    user,
    mailingQualityService.IGNORE_PROJECTION
  );
  await mailingService.assertUserCanEditMailing(user, mailing);

  const qualityIgnores = await mailingQualityService.setIgnored(
    mailing._id,
    change,
    user
  );

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
 * @apiParam (Body) {String[]} [checks] the editor's checks that are on among
 *   broken-links, dangerous-links, domain-blocklists, image-weight,
 *   images-total-weight and oversized-images: only theirs run (links visited
 *   for broken-links only, Web Risk for dangerous-links, blocklists for
 *   domain-blocklists, images downloaded for an image check). Left out, all run.
 * @apiParam (Body) {String} [purpose] `review` (the quality drawer, the
 *   default) or `export` (the gate of a download or an ESP send): each has
 *   its own count of runs.
 *
 * @apiSuccess {Object} links by address: `{ state: ok|broken|unverifiable,
 *   httpStatus?, reason? }`
 * @apiSuccess {Object} images by address: `{ state: ok|unreachable|unverifiable,
 *   bytes, width, height, type, atLeast? }`, as the export will ship them
 * @apiSuccess {Object} blocklists `{ enabled, listed: { domain: [names] },
 *   unchecked: [domains] }`, where QC_DOMAIN_BLOCKLISTS is set
 * @apiSuccess {Object} webRisk `{ enabled, threats: { url: [threat types] },
 *   unchecked: [urls] }`, Google Web Risk, where QC_WEB_RISK_API_KEY is set.
 *   `unchecked` lists what the third party could not answer for: a check
 *   that answered for nothing has not run.
 *
 * @apiDescription Reading the email is enough: nothing is stored. One run at a
 *   time per user, a second one waiting its turn (a third is a 429
 *   `QUALITY_CHECK_RUNNING`), and 20 per 10 minutes for each purpose (429
 *   `QUALITY_CHECKS_TOO_FREQUENT`); anything else in the body, or too many
 *   addresses, is a 422 `INVALID_QUALITY_RESOURCES`. A request the client
 *   closes before the answer fetches nothing more.
 */
async function checkResources(req, res) {
  const { user } = req;
  const { mailingId } = req.params;

  const resources = qualityResourcesService.validateResourcesPayload(req.body);
  // Tenant-scoped: only someone who can open the email has it checked.
  const mailing = await mailingService.findOneForUser(mailingId, user);

  // The editor cancels a run it replaced: the socket closes, and the run
  // stops fetching. Watched on the response: since Node 16 the request's
  // own 'close' fires as soon as its body is read, long before the client
  // could go away. A response closed before it was finished is the client
  // gone.
  const caller = new AbortController();
  res.on('close', () => {
    if (!res.writableFinished) caller.abort();
  });

  const result = await qualityResourcesService.checkResources(resources, {
    userKey: String(user.id || user._id || 'admin'),
    cacheScope: String(mailing._company || 'admin'),
    // The editor builds image URLs from the configured host (mosaico-editor
    // .pug), never from the page's: what the request names is not consulted.
    ownHosts: [config.host].filter(Boolean),
    signal: caller.signal,
  });
  res.json(result);
}
