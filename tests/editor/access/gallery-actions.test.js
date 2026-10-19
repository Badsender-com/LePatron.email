/**
 * @jest-environment jsdom
 */
'use strict';

// Who may rename, edit (save a copy) and delete the images of a gallery, for
// every role, in an editor that may write the email and in a read-only one,
// on the email's gallery and on the template's. The rule is decided once
// (ext/gallery-actions.js); each extension refuses before any request what
// it does not allow.
//
// Decisions: ADR 0004 ("Every role may … use the image gallery"); renaming a
// label writes in the gallery's parent, so it takes the parent's scope: the
// right to write the email, or `platform.manage` for a template.

const $ = require('jquery');
const ko = require('knockout');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const { userOfRole } = require('../helpers/current-user.js');
const {
  galleryActions,
} = require('../../../packages/editor/src/js/ext/gallery-actions.js');
const renameGalleryImage = require('../../../packages/editor/src/js/ext/badsender-rename-gallery-image.js');
const removeGalleryImage = require('../../../packages/editor/src/js/ext/badsender-remove-gallery-image.js');
const editImagePlugin = require('../../../packages/editor/src/js/ext/badsender-edit-image.js');

const FILE = {
  name: '507f1f77bcf86cd799439011-aaa.png',
  label: 'photo.png',
  deleteUrl: '/api/images/507f1f77bcf86cd799439011-aaa.png',
};

// What the decisions above give, written from them rather than read off the
// code under test.
function allowed(role, writable, type) {
  const manages = roleCan(role, CAPABILITIES.GALLERY_MANAGE);
  if (type === 'mailing' && !writable) {
    return { rename: false, edit: false, remove: false };
  }
  const parentScope =
    type === 'mailing' || roleCan(role, CAPABILITIES.PLATFORM_MANAGE);
  return { rename: manages && parentScope, edit: manages, remove: manages };
}

const CASES = Object.values(ROLES).flatMap((role) =>
  [true, false].flatMap((writable) =>
    ['mailing', 'template'].map((type) => [
      role,
      writable ? 'a writable editor' : 'a read-only editor',
      type,
      writable,
    ])
  )
);

function viewModelFor(role, writable) {
  const vm = {
    currentUser: role ? userOfRole(role) : () => null,
    canWriteMailing: writable,
    notifier: { success: jest.fn(), error: jest.fn() },
    t: (key) => key,
    mailingGallery: ko.observableArray([{ ...FILE }]),
    templateGallery: ko.observableArray([{ ...FILE }]),
    mailingGalleryStatus: ko.observable(1),
    templateGalleryStatus: ko.observable(1),
  };
  renameGalleryImage(vm);
  removeGalleryImage(vm);
  editImagePlugin(vm);
  return vm;
}

beforeEach(() => {
  $.ajax = jest.fn(() => new Promise(() => {}));
  window.confirm = jest.fn(() => false);
  global.fetch = jest.fn(() => new Promise(() => {}));
  document.body.innerHTML = `
    <div class="gallery-panel">
      <div class="uploadzone"><input class="fileupload" /></div>
      <div class="gallery-vue-host"><div data-panel></div></div>
    </div>`;
  $.fn.fileupload = function fileupload() {
    return this;
  };
});

afterEach(() => {
  delete window.confirm;
  delete global.fetch;
});

describe('gallery actions — the rule', () => {
  it.each(CASES)('for a %s in %s, on the %s gallery', (role, _, type, w) => {
    expect(galleryActions(viewModelFor(role, w), type)).toEqual(
      allowed(role, w, type)
    );
  });

  // the matrix today, pinned: renaming in a template's gallery is the
  // platform's alone
  it('lets only the super admin rename in a template gallery', () => {
    const renamers = Object.values(ROLES).filter(
      (role) => galleryActions(viewModelFor(role, true), 'template').rename
    );
    expect(renamers).toEqual([ROLES.SUPER_ADMIN]);
  });

  it('allows nothing while the user is unknown', () => {
    ['mailing', 'template'].forEach((type) => {
      expect(galleryActions(viewModelFor(null, true), type)).toEqual({
        rename: false,
        edit: false,
        remove: false,
      });
    });
  });
});

describe('gallery actions — the extensions refuse what the rule does not allow', () => {
  it.each(CASES)(
    'rename, for a %s in %s, on the %s gallery',
    (role, _, type, w) => {
      const vm = viewModelFor(role, w);
      vm.renameImage(vm[`${type}Gallery`]()[0], type, 'nouveau.png');
      const may = allowed(role, w, type).rename;
      expect($.ajax).toHaveBeenCalledTimes(may ? 1 : 0);
      if (!may) {
        expect(vm.notifier.error).toHaveBeenCalledWith(
          'gallery-rename-image-forbidden'
        );
        expect(vm[`${type}Gallery`]()[0].label).toBe('photo.png');
      }
    }
  );

  it.each(CASES)(
    'delete, for a %s in %s, on the %s gallery',
    (role, _, type, w) => {
      const vm = viewModelFor(role, w);
      vm.removeImage(FILE, type);
      const may = allowed(role, w, type).remove;
      // a delete the server would refuse is not even asked about
      expect(window.confirm).toHaveBeenCalledTimes(may ? 1 : 0);
      if (!may) {
        expect(vm.notifier.error).toHaveBeenCalledWith(
          'gallery-remove-image-forbidden'
        );
      }
    }
  );

  it.each(CASES)(
    'edit, for a %s in %s, on the %s gallery',
    (role, _, type, w) => {
      const vm = viewModelFor(role, w);
      vm.editGalleryImage(FILE, type, document.querySelector('[data-panel]'));
      const may = allowed(role, w, type).edit;
      expect(global.fetch).toHaveBeenCalledTimes(may ? 1 : 0);
      if (!may) {
        expect(vm.notifier.error).toHaveBeenCalledWith(
          'gallery-edit-image-forbidden'
        );
      }
    }
  );

  // The pencil on an image of the email saves its copy in the email's
  // gallery: the email gallery's rule.
  it.each(
    Object.values(ROLES).flatMap((role) => [
      [role, 'a writable editor', true],
      [role, 'a read-only editor', false],
    ])
  )('the email pencil, for a %s in %s', async (role, _, w) => {
    const vm = viewModelFor(role, w);
    vm.loadedGallery = () => Promise.resolve([]);
    const pencil = document.querySelector('.uploadzone input');
    vm.editImage(() => FILE.name, pencil);
    // past the gallery lookups, up to the read of the stored file
    await new Promise((resolve) => setTimeout(resolve, 0));
    const may = allowed(role, w, 'mailing').edit;
    expect(global.fetch).toHaveBeenCalledTimes(may ? 1 : 0);
  });
});
