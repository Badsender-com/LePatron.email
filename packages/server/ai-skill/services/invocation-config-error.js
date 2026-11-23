'use strict';

const createError = require('http-errors');

const { InvocationStatuses } = require('../constant/skill-constants.js');

/**
 * Every failure that means "this environment's data does not match the deployed
 * code" — missing/archived skill, missing active version, unresolvable schema
 * id, no configured engine. Grouping them under CONFIG_ERROR lets a caller tell
 * a misconfiguration apart from a provider outage, which is the difference
 * between "fix the setup" and "retry later".
 */
function configError(status, message) {
  const err = createError(status, message);
  // Lets callers (the playground runner) persist the right run status
  // instead of defaulting to PROVIDER_ERROR.
  err.invocationStatus = InvocationStatuses.CONFIG_ERROR;
  return err;
}

module.exports = { configError };
