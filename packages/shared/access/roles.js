'use strict';

// The roles, and what each of them may do: the one definition the server, the
// UI and the editor read (ADR 0004, extending ADR 0002).
//
// A role is a fixed list of capabilities. Nothing is granted by default: a
// capability missing from a role's list is refused, an unknown role has none,
// and a new role starts with none. The code never compares roles to decide a
// right: it asks for a capability, through `can` on the server
// (account/permissions.js), the `CAN` getter in the UI and `userCan` in the
// editor. Where a request takes place (which group, which workspace) is a
// separate question, answered by account/permissions.js on the server.
//
// No syntax that needs a Babel helper here (spread, classes, `for...of`): the
// UI's build compiles this file, and an injected helper import would turn it
// into a module that can no longer use `module.exports`.

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  GROUP_ADMIN: 'company_admin',
  GROUP_ADMIN_TECH: 'company_admin_tech',
  REGULAR_USER: 'regular_user',
  WRITER: 'writer',
  REVIEWER: 'reviewer',
});

const CAPABILITIES = Object.freeze({
  // The platform: companies, templates, ESP profiles, export options, AI
  // skills and playground.
  PLATFORM_MANAGE: 'platform.manage',
  // A company: its settings, users, workspaces, test lists, colours,
  // personalized variables, block library and the moderation of comments.
  GROUP_MANAGE: 'group.manage',
  // A company's technical settings: integrations, AI features, feed mappings
  // and tracking.
  GROUP_MANAGE_TECH: 'group.manage-tech',
  MAILING_CREATE: 'mailing.create',
  // Rename, move, copy, duplicate (translated or not), tag.
  MAILING_ORGANIZE: 'mailing.organize',
  MAILING_DELETE: 'mailing.delete',
  // Save the email from the editor, its email settings, AI translation.
  MAILING_EDIT_CONTENT: 'mailing.edit-content',
  // Blocks and style: held by the editor only, the server cannot tell them
  // apart in a save until #1103.
  MAILING_EDIT_STRUCTURE: 'mailing.edit-structure',
  MAILING_EDIT_STYLE: 'mailing.edit-style',
  // Comment, reply, resolve, approve.
  MAILING_COMMENT: 'mailing.comment',
  MAILING_SEND_TEST: 'mailing.send-test',
  // ZIP, FTP or CDN hosting, ESP.
  MAILING_EXPORT: 'mailing.export',
  // Create, rename and move a folder.
  FOLDER_MANAGE: 'folder.manage',
  // Deleting a folder deletes the emails it holds.
  FOLDER_DELETE: 'folder.delete',
  // Upload, import, rename (its label) and remove an image of the gallery.
  GALLERY_MANAGE: 'gallery.manage',
  // Save a block to the company's library.
  BLOCK_LIBRARY_ADD: 'block-library.add',
});

const ALL_CAPABILITIES = Object.freeze(
  Object.keys(CAPABILITIES).map(function (key) {
    return CAPABILITIES[key];
  })
);

const C = CAPABILITIES;

// Reads, comments, approves, sends tests and exports. Writes no email.
const REVIEWER_CAPABILITIES = [
  C.MAILING_COMMENT,
  C.MAILING_SEND_TEST,
  C.MAILING_EXPORT,
  C.GALLERY_MANAGE,
];

// Edits the content and declines the existing emails into variants (copy,
// duplicate). Starts no email from a template and deletes nothing; the
// structure and the style are locked in the editor.
const WRITER_CAPABILITIES = REVIEWER_CAPABILITIES.concat([
  C.MAILING_EDIT_CONTENT,
  C.MAILING_ORGANIZE,
  C.FOLDER_MANAGE,
]);

const REGULAR_USER_CAPABILITIES = WRITER_CAPABILITIES.concat([
  C.MAILING_CREATE,
  C.MAILING_DELETE,
  C.MAILING_EDIT_STRUCTURE,
  C.MAILING_EDIT_STYLE,
  C.FOLDER_DELETE,
  C.BLOCK_LIBRARY_ADD,
]);

const GROUP_ADMIN_CAPABILITIES = REGULAR_USER_CAPABILITIES.concat([
  C.GROUP_MANAGE,
]);

// A company admin with the technical settings on top (product decision of
// 2026-10-13).
const GROUP_ADMIN_TECH_CAPABILITIES = GROUP_ADMIN_CAPABILITIES.concat([
  C.GROUP_MANAGE_TECH,
]);

const CAPABILITIES_BY_ROLE = {};
CAPABILITIES_BY_ROLE[ROLES.SUPER_ADMIN] = ALL_CAPABILITIES;
CAPABILITIES_BY_ROLE[ROLES.GROUP_ADMIN_TECH] = GROUP_ADMIN_TECH_CAPABILITIES;
CAPABILITIES_BY_ROLE[ROLES.GROUP_ADMIN] = GROUP_ADMIN_CAPABILITIES;
CAPABILITIES_BY_ROLE[ROLES.REGULAR_USER] = REGULAR_USER_CAPABILITIES;
CAPABILITIES_BY_ROLE[ROLES.WRITER] = WRITER_CAPABILITIES;
CAPABILITIES_BY_ROLE[ROLES.REVIEWER] = REVIEWER_CAPABILITIES;
Object.keys(CAPABILITIES_BY_ROLE).forEach(function (role) {
  Object.freeze(CAPABILITIES_BY_ROLE[role]);
});
Object.freeze(CAPABILITIES_BY_ROLE);

/**
 * A misspelt capability would be refused to everyone, silently: it throws
 * instead.
 *
 * @param {string} capability
 */
function assertCapability(capability) {
  if (ALL_CAPABILITIES.indexOf(capability) === -1) {
    throw new Error('Unknown capability: ' + capability);
  }
}

/**
 * @param {string} role
 * @returns {string[]} the role's capabilities, none for an unknown role
 */
function capabilitiesOfRole(role) {
  return Object.prototype.hasOwnProperty.call(CAPABILITIES_BY_ROLE, role)
    ? CAPABILITIES_BY_ROLE[role]
    : [];
}

/**
 * @param {string} role
 * @param {string} capability one of CAPABILITIES
 * @returns {boolean}
 */
function roleCan(role, capability) {
  assertCapability(capability);
  return capabilitiesOfRole(role).indexOf(capability) !== -1;
}

/**
 * Whether every capability of `role` is among `capabilities`. Nobody grants a
 * role, or manages an account, that can do more than they can: a company admin
 * neither makes a tech admin nor takes over one's account.
 *
 * @param {string} role
 * @param {string[]} capabilities the actor's
 * @returns {boolean}
 */
function isRoleWithin(role, capabilities) {
  if (!Object.prototype.hasOwnProperty.call(CAPABILITIES_BY_ROLE, role)) {
    return false;
  }
  return capabilitiesOfRole(role).every(function (capability) {
    return capabilities.indexOf(capability) !== -1;
  });
}

module.exports = {
  ROLES: ROLES,
  CAPABILITIES: CAPABILITIES,
  ALL_CAPABILITIES: ALL_CAPABILITIES,
  assertCapability: assertCapability,
  capabilitiesOfRole: capabilitiesOfRole,
  roleCan: roleCan,
  isRoleWithin: isRoleWithin,
};
