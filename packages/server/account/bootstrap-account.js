'use strict';

const config = require('../node.config.js');

/**
 * The bootstrap account is the super admin defined by the deployment
 * configuration: it has no document in the database (ADR 0002). Checks that
 * need a stored user, such as session tracking or ownership of what the
 * account creates, key on its identity, never on `isAdmin`, which any
 * persisted super admin also carries.
 *
 * @param {Object} user the request user, as passport deserialised it
 * @returns {boolean}
 */
function isBootstrapAccount(user) {
  return !!user && String(user.id) === String(config.admin.id);
}

module.exports = { isBootstrapAccount };
