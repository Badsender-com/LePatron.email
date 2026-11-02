'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('../account/permissions.js');

/**
 * The reach of a user management request: an admin reaches every account,
 * a company admin reaches the accounts of their own group.
 */

function assertActorReaches(actor, target) {
  if (!permissions.canAccessGroup(actor, permissions.groupIdOf(target))) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

function assertActorCreatesIn(actor, groupId) {
  if (!permissions.canAccessGroup(actor, groupId)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

module.exports = { assertActorReaches, assertActorCreatesIn };
