'use strict';

const {
  assertCapability,
  CAPABILITIES,
} = require('../../../../shared/access/roles.js');

// What writes this email, so needs the right to write where it lives (its
// workspace or folder) on top of the capability.
const WRITES_THE_EMAIL = [
  CAPABILITIES.MAILING_EDIT_CONTENT,
  CAPABILITIES.MAILING_EDIT_STRUCTURE,
  CAPABILITIES.MAILING_EDIT_STYLE,
  CAPABILITIES.MAILING_ORGANIZE,
];

/**
 * Whether the current user holds `capability`, one of the capabilities the
 * server sends with the current user (packages/shared/access/roles.js): the
 * editor shows what the server will accept, and knows no role.
 *
 * Writing the email also needs the server's answer for its workspace
 * (`vm.canWriteMailing`, from the editor's metadata): a member who may only
 * read the workspace edits nothing.
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
  if (vm.canWriteMailing === false && WRITES_THE_EMAIL.includes(capability)) {
    return false;
  }
  return Boolean(
    user &&
      Array.isArray(user.capabilities) &&
      user.capabilities.includes(capability)
  );
}

module.exports = { userCan };
