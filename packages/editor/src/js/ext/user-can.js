'use strict';

const {
  assertCapability,
} = require('../../../../shared/access/roles.js');

/**
 * Whether the current user holds `capability`, one of the capabilities the
 * server sends with the current user (packages/shared/access/roles.js): the
 * editor shows what the server will accept, and knows no role.
 *
 * Locked until the user is known: `currentUser` is loaded asynchronously and is
 * `null` at first, and an editor without it denies rather than allows. Reads the
 * observable, so a binding calling this re-evaluates once the user arrives.
 *
 * @param {Object} vm the editor view-model
 * @param {string} capability one of CAPABILITIES; a misspelt one throws
 * @returns {boolean}
 */
function userCan(vm, capability) {
  assertCapability(capability);
  const user = typeof vm.currentUser === 'function' ? vm.currentUser() : null;
  return Boolean(
    user &&
      Array.isArray(user.capabilities) &&
      user.capabilities.includes(capability)
  );
}

module.exports = { userCan };
