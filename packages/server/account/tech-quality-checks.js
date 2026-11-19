'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('./permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const { keepsTechChecks } = require('../utils/sanitize-quality-settings.js');

/**
 * Refuses merged quality settings that change the checks of the company's
 * technical settings (TECH_CHECKS) for a user who cannot set them: the
 * required tracking parameters are set with the company's tracking, a tech
 * admin's (ADR 0009). The whole request is refused, rather than the change
 * silently dropped and the rest saved.
 *
 * @param {Object} user the signed-in user
 * @param {Object} [stored] the settings stored on the group or template
 * @param {{ checks: Object }} next the settings sanitizeQualitySettings merged
 * @throws {Forbidden} ERROR_CODES.FORBIDDEN_TECH_QUALITY_CHECK
 */
function assertTechChecksAllowed(user, stored, next) {
  if (permissions.can(user, CAPABILITIES.GROUP_MANAGE_TECH)) return;
  if (keepsTechChecks(stored, next)) return;
  throw new Forbidden(ERROR_CODES.FORBIDDEN_TECH_QUALITY_CHECK);
}

module.exports = { assertTechChecksAllowed };
