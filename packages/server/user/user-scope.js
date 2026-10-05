'use strict';

const { Forbidden } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');

/**
 * The reach of a user management request: an admin reaches every account,
 * a company admin reaches the accounts of their own group.
 */

/**
 * The company of a user, whatever shape it comes in: the session's JSON
 * (`group` and `_company` serialised without `_id`), a Mongoose document
 * (populated or not), or a plain record.
 */
function companyIdOf(user) {
  const company = user.group || user._company;
  if (!company) return undefined;
  if (typeof company === 'string') return company;
  if (company._id) return String(company._id);
  if (typeof company.id === 'string') return company.id;
  return String(company);
}

function assertActorReaches(actor, target) {
  if (actor?.isAdmin) return;
  const own = companyIdOf(actor);
  if (!own || own !== companyIdOf(target)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

function assertActorCreatesIn(actor, groupId) {
  if (actor?.isAdmin) return;
  const own = companyIdOf(actor);
  if (!own || !groupId || String(groupId) !== own) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_USER_ACCESS);
  }
}

module.exports = { assertActorReaches, assertActorCreatesIn, companyIdOf };
