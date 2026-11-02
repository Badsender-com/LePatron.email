'use strict';

const createError = require('http-errors');

const permissions = require('./permissions.js');
const ERROR_CODES = require('../constant/error-codes.js');

const capabilityGuards = new Map();

/**
 * The route needs `capability`; a role without it is refused, whatever the
 * route, so a new route that writes declares what it needs or a test fails.
 * One middleware per capability, so tests compare guards by identity.
 *
 * @param {string} capability one of CAPABILITIES; a misspelt one throws here,
 *   when the routes load, rather than refusing everyone
 * @returns {Function} express middleware
 */
function GUARD_CAN(capability) {
  permissions.can(null, capability);
  if (!capabilityGuards.has(capability)) {
    capabilityGuards.set(capability, capabilityGuard(capability));
  }
  return capabilityGuards.get(capability);
}

function capabilityGuard(capability) {
  const middleware = (req, res, next) => {
    if (!req.user) return next(new createError.Unauthorized());
    if (!permissions.can(req.user, capability)) {
      return next(new createError.Forbidden(ERROR_CODES.FORBIDDEN_CAPABILITY));
    }
    return next();
  };
  middleware.access = { capabilities: [capability] };
  return middleware;
}

module.exports = { GUARD_CAN };
