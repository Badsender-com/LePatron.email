'use strict';

// The rename extension on a stand-in viewModel, with the answers jQuery's
// ajax gives. The suite mocks `jquery` itself, before requiring this.

const ko = require('knockout');
const renameGalleryImage = require('../../../packages/editor/src/js/ext/badsender-rename-gallery-image.js');
const { userOfRole } = require('./current-user.js');

const MONGO_ID = '6a2135b7f802c2a6f99a4242';
const FILE = { name: `${MONGO_ID}-abc.png`, label: 'avant.png', url: 'x' };
const OTHER = { name: `${MONGO_ID}-def.png`, label: 'autre.png' };

function viewModel(files = [FILE, OTHER]) {
  const vm = {
    mailingGallery: ko.observableArray(files.map((f) => ({ ...f }))),
    // who may rename (access/gallery-actions.test.js covers the others)
    currentUser: userOfRole('regular_user'),
    notifier: { error: jest.fn(), success: jest.fn() },
    t: (key) => key,
  };
  renameGalleryImage(vm);
  return vm;
}

const accepted = () => Promise.resolve({});
// jQuery rejects with a jqXHR object, not an Error
const jqXHR = (status) =>
  Object.assign(new Error(`HTTP ${status}`), { status });
const refused = () => Promise.reject(new Error('500'));

module.exports = {
  MONGO_ID,
  FILE,
  OTHER,
  viewModel,
  accepted,
  jqXHR,
  refused,
};
