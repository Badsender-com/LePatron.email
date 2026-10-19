'use strict';

const { CAPABILITIES } = require('../../../../shared/access/roles.js');
const { userCan } = require('./user-can.js');

const NONE = Object.freeze({
  upload: false,
  rename: false,
  edit: false,
  remove: false,
});

/**
 * What the user may do to the images of one gallery, as the server will
 * answer it. The one place that says so: the panel shows these actions and
 * nothing else, and each extension refuses the others before any request,
 * so a new way in cannot open a path that can only fail.
 *
 * - Uploading, editing (which adds a copy) and deleting need
 *   `gallery.manage`.
 * - Renaming a label writes in the gallery's parent, with that parent's
 *   scope: the email's gallery needs the right to write the email (its
 *   workspace or folder), the template's needs `platform.manage`, since
 *   templates are edited by the platform alone.
 * - In an editor that may not write the email, nothing writes in its
 *   gallery, and nothing is uploaded to the template's: no zone to drop a
 *   file on, and no editing either, whose copy is uploaded through that
 *   zone's input (badsender-edit-image.js). Renaming and deleting a
 *   template image keep their own rule, which says nothing of the email.
 *
 * Denied while the user is unknown, like `userCan`. Reads the current user
 * observable, so a binding calling this re-evaluates once the user arrives.
 *
 * @param {Object} vm the editor view-model
 * @param {'mailing'|'template'} type which of the two galleries
 * @returns {{ upload: boolean, rename: boolean, edit: boolean, remove: boolean }}
 */
function galleryActions(vm, type) {
  const manages = userCan(vm, CAPABILITIES.GALLERY_MANAGE);
  if (type === 'mailing') {
    if (vm.canWriteMailing === false) return NONE;
    return { upload: manages, rename: manages, edit: manages, remove: manages };
  }
  if (type === 'template') {
    const ownsTemplates = userCan(vm, CAPABILITIES.PLATFORM_MANAGE);
    const uploads = manages && vm.canWriteMailing !== false;
    return {
      upload: uploads,
      rename: manages && ownsTemplates,
      edit: uploads,
      remove: manages,
    };
  }
  return NONE;
}

/**
 * The extensions' guard: whether `action` is allowed on the gallery of
 * `type`, and the refusal said when it is not. A click that does nothing at
 * all is the failure nobody can describe.
 *
 * @param {Object} vm the editor view-model
 * @param {'mailing'|'template'} type
 * @param {'upload'|'rename'|'edit'|'remove'} action
 * @param {string} refusalKey the translation shown on a refusal
 * @returns {boolean}
 */
function mayDo(vm, type, action, refusalKey) {
  if (galleryActions(vm, type)[action]) return true;
  vm.notifier.error(vm.t(refusalKey));
  return false;
}

module.exports = { galleryActions, mayDo, NO_GALLERY_ACTIONS: NONE };
