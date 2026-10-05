'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

/**
 * The reach of a user management request: an admin reaches every account,
 * a company admin reaches the accounts of their own group.
 */

const companyIdOf = (user) =>
  String(user._company?._id || user._company || user.group?.id);

function assertActorReaches(actor, target) {
  if (actor?.isAdmin) return;
  if (companyIdOf(actor) !== companyIdOf(target)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

function assertActorCreatesIn(actor, groupId) {
  if (actor?.isAdmin) return;
  if (!groupId || String(groupId) !== companyIdOf(actor)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

module.exports = { assertActorReaches, assertActorCreatesIn };
