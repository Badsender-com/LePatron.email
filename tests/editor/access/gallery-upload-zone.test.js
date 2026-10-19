/**
 * @jest-environment jsdom
 */

'use strict';

// The upload zone above each gallery: a button and a file drop. In an editor
// that may not write the email, nothing writes in the email's gallery, so its
// zone goes, on the same rule as the thumbnails' actions
// (ext/gallery-actions.js). Rendered from the template the editor ships, for
// each role. The template's gallery keeps its zone as it was.

const fs = require('fs');
const path = require('path');
const ko = require('knockout');
const {
  galleryActions,
} = require('../../../packages/editor/src/js/ext/gallery-actions.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const { userOfRole } = require('../helpers/current-user.js');

const TEMPLATE = fs.readFileSync(
  path.join(
    __dirname,
    '../../../packages/editor/src/tmpl-badsender/gallery-upload.tmpl.html'
  ),
  'utf8'
);

// Mosaico's own bindings, which need jQuery UI and the upload plugin; only
// whether the zone is rendered matters here.
const MOSAICO_BINDINGS = ['fudroppable', 'fileupload'];

beforeAll(() => {
  MOSAICO_BINDINGS.forEach((name) => {
    ko.bindingHandlers[name] = { init() {} };
  });
});

afterAll(() => {
  MOSAICO_BINDINGS.forEach((name) => delete ko.bindingHandlers[name]);
});

afterEach(() => {
  document.body.innerHTML = '';
});

// as toolbox.tmpl.html calls it: `template: { name: 'gallery-upload', data: { type } }`
function zoneShown(type, currentUser, canWriteMailing = true) {
  const vm = { currentUser, canWriteMailing };
  const root = {
    t: (key) => key,
    notifier: { error: () => {} },
    loadMailingImage: () => {},
    loadTemplateImage: () => {},
    galleryActions: (galleryType) => galleryActions(vm, galleryType),
  };
  const host = document.createElement('div');
  host.innerHTML = `<!-- ko with: { type: '${type}' } -->${TEMPLATE}<!-- /ko -->`;
  document.body.appendChild(host);
  ko.applyBindings(root, host);
  return host.querySelector('.uploadzone input[type="file"]') !== null;
}

const BOTH_EDITORS = Object.values(ROLES).flatMap((role) => [
  [role, 'a writable editor', true],
  [role, 'a read-only editor', false],
]);

describe('the upload zone of the email gallery', () => {
  it.each(BOTH_EDITORS)('for a %s in %s', (role, _, writable) => {
    expect(zoneShown('mailing', userOfRole(role), writable)).toBe(
      writable && roleCan(role, CAPABILITIES.GALLERY_MANAGE)
    );
  });

  it('is not offered before the user is known', () => {
    expect(zoneShown('mailing', () => null)).toBe(false);
  });

  // the matrix grants it to every role today; the next one may not
  it('is not offered to a user without gallery.manage', () => {
    expect(zoneShown('mailing', () => ({ role: 'x', capabilities: [] }))).toBe(
      false
    );
  });
});

describe('the upload zone of the template gallery', () => {
  it.each(BOTH_EDITORS)('stays as it was for a %s in %s', (role, _, w) => {
    expect(zoneShown('template', userOfRole(role), w)).toBe(true);
  });
});
