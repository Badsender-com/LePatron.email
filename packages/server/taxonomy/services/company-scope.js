'use strict';

const { Types } = require('mongoose');
const { BadRequest, Forbidden } = require('http-errors');

const ERROR_CODES = require('../../constant/error-codes.js');
const permissions = require('../../account/permissions.js');
const { selectedGroupIdOf } = require('../../account/request-scope.js');
const { CAPABILITIES } = require('../../../shared/access/roles.js');
const { isObjectId } = require('./taxonomy.validation.js');

module.exports = { resolveCompanyId, scopedById };

/**
 * The company every query of the taxonomy services is bounded to.
 *
 * Route guards already check that a caller may reach the `:groupId` of the URL,
 * but a guard is a separate statement from the query that follows it. Resolving
 * the company here, once, means every read and write below carries the boundary
 * itself — so a missing guard on a future route cannot turn into a cross-company
 * read or write.
 *
 * A super admin may target any company: the one the request names, or else the
 * one it has selected.
 *
 * @param {Object} user
 * @param {string} [requestedGroupId] company named by the request
 * @returns {ObjectId}
 */
function resolveCompanyId(user, requestedGroupId) {
  if (!user) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }

  const ownGroupId = user.group?.id;

  if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
    // Naming another company is refused rather than silently redirected to the
    // caller's own: a request that asks for something it may not have should not
    // quietly succeed on something else.
    if (
      requestedGroupId &&
      !permissions.canAccessGroup(user, String(requestedGroupId))
    ) {
      throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
    }
    if (!ownGroupId) {
      throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
    }
    // Checked, not assumed: a malformed id on the session would otherwise raise a
    // BSON error, hence a 500 where a 400 belongs.
    if (!isObjectId(ownGroupId)) {
      throw new BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
    }
    return Types.ObjectId(String(ownGroupId));
  }

  // A super admin acts for the company it names, or else for the one it has
  // selected (ADR 0002, amended), never for its own: falling back on
  // `user.group` would read or write the platform's.
  const groupId = requestedGroupId || selectedGroupIdOf(user);
  if (!groupId) {
    throw new BadRequest(ERROR_CODES.MISSING_GROUP_PARAM);
  }
  if (!isObjectId(groupId)) {
    throw new BadRequest(ERROR_CODES.INVALID_GROUP_PARAM);
  }

  return Types.ObjectId(String(groupId));
}

/**
 * The filter that loads one record of the taxonomy by its id, bounded to the
 * caller's company in the same query: a record of another company reads as
 * "not found", and the caller learns nothing about what exists elsewhere.
 *
 * @param {Object} user
 * @param {string} id already checked to be an ObjectId
 * @returns {Object} a MongoDB filter
 */
function scopedById(user, id) {
  const query = { _id: Types.ObjectId(String(id)) };

  // A super admin edits across companies, but everyone else is bounded here and
  // not only by the route guard.
  if (!permissions.can(user, CAPABILITIES.PLATFORM_MANAGE)) {
    query._company = resolveCompanyId(user);
  }

  return query;
}
