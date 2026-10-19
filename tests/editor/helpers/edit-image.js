'use strict';

// The editor around ext/badsender-edit-image.js, for the suites that drive
// it: the two panes' upload widgets, a viewModel, and the read of the stored
// file. The extension never talks to Konva: it hands the stored bytes to the
// upload widget, which is all these stand-ins record.

const $ = require('jquery');
const editImagePlugin = require('../../../packages/editor/src/js/ext/badsender-edit-image.js');
const { userOfRole } = require('./current-user.js');

const PNG = '507f1f77bcf86cd799439011-aaa.png';
const JPG = '507f1f77bcf86cd799439011-bbb.jpg';

// The two panes sit side by side, each with its own upload widget. Which one
// receives the file is the whole reason the caller passes an element.
const MARKUP = `
  <div id="toolimagesgallery" class="gallery-panel">
    <div class="uploadzone">
      <input class="fileupload" data-pane="mailing" />
    </div>
    <div class="gallery-vue-host">
      <div class="gallery-vue-panel" data-panel="mailing"></div>
    </div>
  </div>
  <div id="toolimagesgallerytemplate" class="gallery-panel">
    <div class="uploadzone">
      <input class="fileupload" data-pane="template" />
      <div class="tool edit" data-pencil="template"></div>
    </div>
    <div class="gallery-vue-host">
      <div class="gallery-vue-panel" data-panel="template"></div>
    </div>
  </div>
`;

// `loaded: false` is an editor where neither gallery was opened yet: the
// observables are empty until something asks for them to be loaded.
function makeViewModel(mailing = [], template = [], { loaded = true } = {}) {
  const lists = { mailing, template };
  const shown = loaded ? { ...lists } : { mailing: [], template: [] };
  return {
    mailingGallery: () => shown.mailing,
    templateGallery: () => shown.template,
    loadedGallery: jest.fn((type) => {
      shown[type] = lists[type];
      return Promise.resolve(shown[type]);
    }),
    currentUser: userOfRole('regular_user'),
    notifier: { success: jest.fn(), error: jest.fn() },
    t: (key) => key,
  };
}

function respondWith(blob, ok = true) {
  global.fetch = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 404,
    blob: () => Promise.resolve(blob),
  });
}

/**
 * A fresh editor in the document: the markup, the upload widgets recording
 * what they are handed, a stored file that reads back, and the extension
 * installed on a viewModel.
 *
 * @returns {{ viewModel: Object, added: Object[] }}
 */
function setUpEditor() {
  document.body.innerHTML = MARKUP;
  const added = [];
  // the real widget is a blueimp plugin; only the handover is under test
  $.fn.fileupload = function fileupload(action, data) {
    added.push({ pane: this.attr('data-pane'), action, data });
    return this;
  };
  respondWith(new Blob(['pixels'], { type: 'image/png' }));
  const viewModel = makeViewModel();
  editImagePlugin(viewModel);
  return { viewModel, added };
}

const panel = (type) => document.querySelector(`[data-panel="${type}"]`);

module.exports = {
  PNG,
  JPG,
  makeViewModel,
  respondWith,
  setUpEditor,
  panel,
};
