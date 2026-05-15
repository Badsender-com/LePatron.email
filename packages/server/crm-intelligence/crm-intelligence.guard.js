'use strict';

const createError = require('http-errors');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

/**
 * Middleware that checks if CRM Intelligence is enabled for the user's group.
 * Attaches `req.crmGroup` with the group data for downstream handlers.
 * Must be used after GUARD_USER (requires `req.user`).
 */
async function guardCrmIntelligence(req, res, next) {
  const { user } = req;

  if (!user.group || !user.group.id) {
    return next(createError(400, ERROR_CODES.GROUP_NOT_FOUND));
  }

  const group = await Groups.findById(user.group.id)
    .select('enableCrmIntelligence')
    .lean();

  if (!group) {
    return next(createError(404, ERROR_CODES.GROUP_NOT_FOUND));
  }

  req.crmGroup = group;
  next();
}

module.exports = { guardCrmIntelligence };
