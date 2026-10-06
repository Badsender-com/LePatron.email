'use strict';

/**
 * Whether the current user holds a capability computed by
 * badsender-current-user.js (`canEditStructure`, `canEditStyle`, ...).
 *
 * Locked until the user is known: `currentUser` is loaded asynchronously and is
 * `null` at first, and an editor without it denies rather than allows. Reads the
 * observable, so a binding calling this re-evaluates once the user arrives.
 *
 * @param {Object} vm the editor view-model
 * @param {string} capability
 * @returns {boolean}
 */
function userCan(vm, capability) {
  const user = typeof vm.currentUser === 'function' ? vm.currentUser() : null;
  return Boolean(user && user[capability]);
}

module.exports = { userCan };
