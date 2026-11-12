'use strict';

const asyncHandler = require('express-async-handler');

const mailingService = require('./mailing.service.js');
const {
  buildGovernanceContext,
} = require('../taxonomy/services/governance-context.service.js');

module.exports = { readGovernanceContext: asyncHandler(readGovernanceContext) };

/**
 * @api {get} /mailings/:mailingId/governance-context the email's governance
 * @apiPermission user
 * @apiName ReadMailingGovernanceContext
 * @apiGroup Mailings
 *
 * @apiParam {string} mailingId
 *
 * @apiSuccess {Object[]} dimensions each active dimension the email has a value
 *   for: `name`, `label`, `description`, and `value` (`label`, `identifier`,
 *   `description`)
 * @apiSuccess {String[]} missing the active dimensions the email leaves empty
 * @apiSuccess {String} language the email's language, ISO 639-1, null when
 *   unknown (ADR-0023)
 * @apiSuccess {String} locale the email's locale, `fr-BE` or `fr`, null when
 *   unknown
 * @apiSuccess {String} text the same facts as text, empty when there are none
 *
 * @apiDescription What an AI writing assistant is handed about this email. Read
 *   only, and not a prompt: the feature that calls a model assembles it.
 */
async function readGovernanceContext(req, res) {
  const { user } = req;

  // Scoped on the user's company: an email of another one reads as absent.
  const mailing = await mailingService.findOneForUser(
    req.params.mailingId,
    user
  );

  res.json(await buildGovernanceContext({ mailing, lang: user.lang }));
}
