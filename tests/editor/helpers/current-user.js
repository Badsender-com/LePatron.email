'use strict';

const {
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

/**
 * The editor's `currentUser` observable for a user of `role`, as the server
 * sends it: the role's capabilities (packages/shared/access/roles.js).
 *
 * @param {string} role
 * @returns {Function}
 */
function userOfRole(role) {
  return () => ({ role, capabilities: capabilitiesOfRole(role) });
}

module.exports = { userOfRole };
