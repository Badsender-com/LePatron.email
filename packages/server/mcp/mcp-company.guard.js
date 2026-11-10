'use strict';

const createError = require('http-errors');

const permissions = require('../account/permissions.js');
const ERROR_CODES = require('../constant/error-codes.js');
const { isObjectIdString } = require('../utils/model.js');

/**
 * The company a route of its MCP settings names in its path (ADR 0012): its
 * clients registered by hand, its connected applications. The capability is
 * asked apart (`GUARD_CAN(GROUP_MANAGE_TECH)`); this is the scope alone: a
 * super admin reaches every company, anyone else their own. The capability
 * already says who manages them, so the scope adds no second right, as
 * `canManageGroup` would with `group.manage`.
 *
 * Express hands a route the `groupId` of its mount path, a string: anything
 * but an id is refused before a query reads it.
 */
function GUARD_MCP_COMPANY(req, res, next) {
  const { groupId } = req.params;
  if (!isObjectIdString(groupId)) {
    return next(createError(400, ERROR_CODES.INVALID_GROUP_PARAM));
  }
  if (!permissions.canAccessGroup(req.user, groupId)) {
    return next(new createError.Forbidden(ERROR_CODES.MCP_FORBIDDEN_COMPANY));
  }
  return next();
}

module.exports = { GUARD_MCP_COMPANY };
