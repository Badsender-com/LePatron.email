/**
 * @jest-environment jsdom
 */
'use strict';

// What the gallery panel offers on its thumbnails, for each role, in a
// writable and a read-only editor, on both galleries.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });

const ko = require('knockout');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const { userOfRole } = require('../helpers/current-user.js');
const {
  galleryActions,
} = require('../../../packages/editor/src/js/ext/gallery-actions.js');
const {
  IMAGES,
  fakeViewModel,
  mountVm,
} = require('../helpers/gallery-panel.js');

// What the panel offers on its thumbnails comes from the one rule
// (ext/gallery-actions.js), for the pane's own gallery; the matrix itself is
// in access/gallery-actions.test.js. The current user is a Knockout
// observable loaded after the editor opens, re-read once it arrives.
describe('gallery panel — the actions it offers', () => {
  function mountWithUser(currentUser, { type = 'mailing', writable } = {}) {
    const vm = fakeViewModel(IMAGES.slice());
    vm.templateGallery = ko.observableArray(IMAGES.slice());
    vm.templateGalleryStatus = ko.observable(IMAGES.length);
    vm.currentUser = currentUser;
    vm.canWriteMailing = writable;
    return { vm, panel: mountVm(vm, type) };
  }

  it.each(
    Object.values(ROLES).flatMap((role) =>
      [true, false].flatMap((writable) =>
        ['mailing', 'template'].map((type) => [role, writable, type])
      )
    )
  )(
    'asks the rule for a %s (writable: %s) on the %s gallery',
    (role, w, type) => {
      const currentUser = ko.observable(userOfRole(role)());
      const { vm, panel } = mountWithUser(currentUser, { type, writable: w });
      expect(panel.actions).toEqual(galleryActions(vm, type));
      panel.$destroy();
    }
  );

  it('allows nothing while the user is unknown, then re-reads once loaded', () => {
    const user = ko.observable(null);
    const { panel } = mountWithUser(user);
    expect(panel.actions).toEqual({
      rename: false,
      edit: false,
      remove: false,
    });
    user(userOfRole(ROLES.WRITER)());
    expect(panel.actions).toEqual({ rename: true, edit: true, remove: true });
    panel.$destroy();
    expect(user.getSubscriptionsCount()).toBe(0);
  });

  it('survives an editor whose view-model carries no user', () => {
    const { panel } = mountWithUser(undefined);
    expect(panel.actions).toEqual({
      rename: false,
      edit: false,
      remove: false,
    });
    panel.$destroy();
  });
});
