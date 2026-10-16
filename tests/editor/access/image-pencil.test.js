/**
 * @jest-environment jsdom
 */

'use strict';

// The pencil on an image of the email reopens the image editor, and saving
// there uploads a copy to the gallery, which the server accepts only with
// `gallery.manage`. Rendered from the template the editor ships, for each
// role: the pencil is offered exactly to the roles the server lets save.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const { userCan } = require('../../../packages/editor/src/js/ext/user-can.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const { userOfRole } = require('../helpers/current-user.js');

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl/img-wysiwyg.tmpl.html'
  ),
  'utf8'
);

// The image's tool bar, alone: the rest of the template needs Mosaico's
// custom bindings.
const MIDTOOLS = /<div class="midtools"[\s\S]*?\n {2}<\/div>/
  .exec(TEMPLATE)[0]
  .replace(' data-bind="tooltips: {}"', '');

function pencilShown(currentUser) {
  const vm = { currentUser };
  const root = {
    _src: ko.observable('a.png'),
    t: (key) => key,
    userCan: (capability) => userCan(vm, capability),
    editImage: () => {},
  };
  const host = document.createElement('div');
  host.innerHTML = MIDTOOLS;
  document.body.appendChild(host);
  ko.applyBindings(root, host);
  return host.querySelector('.tool.edit') !== null;
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('the pencil on an image of the email', () => {
  it.each(Object.values(ROLES))('follows gallery.manage for a %s', (role) => {
    expect(pencilShown(userOfRole(role))).toBe(
      roleCan(role, CAPABILITIES.GALLERY_MANAGE)
    );
  });

  it('is not offered before the user is known', () => {
    expect(pencilShown(() => null)).toBe(false);
  });

  // the matrix grants it to every role today; the next one may not
  it('is not offered to a user without gallery.manage', () => {
    expect(pencilShown(() => ({ role: 'x', capabilities: [] }))).toBe(false);
  });
});
