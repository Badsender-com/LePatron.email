'use strict';

const createError = require('http-errors');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const { listingGroupIdOf } = require('../account/request-scope.js');
const permissions = require('../account/permissions.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');

/**
 * Middleware that enforces CRM Intelligence access for the user's group:
 * - Rejects with 403 if `enableCrmIntelligence` is not true.
 * - Attaches `req.crmGroup` with the group data for downstream handlers.
 *
 * Must be used after GUARD_USER (requires `req.user`).
 *
 * Use `guardCrmIntelligenceProbe` instead for endpoints that need to answer
 * "is the module available?" without throwing when it is disabled (typically
 * /status, which serves as the UI's probe).
 */
async function guardCrmIntelligence(req, res, next) {
  return loadGroupAndAttach(req, next, { enforceFlag: true });
}

/**
 * Probe variant: loads `req.crmGroup` without throwing when the flag is off,
 * so the controller can return `{ enabled: false }` rather than a 403.
 */
async function guardCrmIntelligenceProbe(req, res, next) {
  return loadGroupAndAttach(req, next, { enforceFlag: false });
}

async function loadGroupAndAttach(req, next, { enforceFlag }) {
  try {
    const user = req.user || {};
    // The dashboards of the user's own group, or of a super admin's selected
    // group; the bootstrap account is refused (ADR 0002, amended).
    const groupId = listingGroupIdOf(user);

    const group = await Groups.findById(groupId)
      .select('enableCrmIntelligence')
      .lean();

    if (!group) {
      return next(createError(404, ERROR_CODES.GROUP_NOT_FOUND));
    }

    // The lock is part of the view for a super admin: the screen shows it,
    // the server never refuses a super admin for a module flag.
    if (
      enforceFlag &&
      group.enableCrmIntelligence !== true &&
      !permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)
    ) {
      return next(createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED));
    }

    req.crmGroup = group;
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { guardCrmIntelligence, guardCrmIntelligenceProbe };
