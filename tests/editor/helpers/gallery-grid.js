'use strict';

// The gallery panel mounted inside the document, where jsdom's zero-size
// layout still leaves the scroller its buffer and it renders its first rows
// (detached, it renders none). For the suites that need real thumbnails.
// The suite mocks `jquery-ui/ui/widgets/draggable` before requiring this.
require('./intersection-observer');

const Vue = require('vue/dist/vue.common');
const $ = require('jquery');
const ko = require('knockout');
const {
  createGalleryPanel,
} = require('../../../packages/editor/src/js/vue/galleryPlugin.js');
const { userOfRole } = require('./current-user.js');

// the real widget is installed on jQuery by the gulp build, not by Node
$.fn.draggable = function draggable() {
  return this;
};

/**
 * @param {Object[]} images the mailing gallery
 * @param {Object} [overrides] properties of the viewModel to replace
 * @returns {Promise<{ vm: Object, panel: Vue }>}
 */
async function mountGrid(images, overrides = {}) {
  const vm = {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage: jest.fn(),
    removeImage: jest.fn(),
    mailingGallery: ko.observableArray(images.slice()),
    mailingGalleryStatus: ko.observable(images.length),
    // a user who may manage the gallery, so the action bar is rendered
    currentUser: userOfRole('regular_user'),
    ...overrides,
  };
  const host = document.createElement('div');
  document.body.appendChild(host);
  const Panel = Vue.extend(createGalleryPanel(vm));
  const panel = new Panel({ propsData: { type: 'mailing' } }).$mount(host);
  await Vue.nextTick();
  await Vue.nextTick();
  return { vm, panel };
}

// The scroller parks the views it no longer needs off-screen instead of
// removing them; the panel hides their cell.
function thumbsOf(panel) {
  return Array.from(panel.$el.querySelectorAll('.gallery-thumb')).filter(
    (el) => !el.closest('.gallery-vue-cell').hidden
  );
}

function thumbOf(panel, name) {
  return thumbsOf(panel).find(
    (el) => ko.utils.domData.get(el, 'ko_dragItem').name === name
  );
}

function unmountGrid(panel) {
  panel.$destroy();
  document.body.innerHTML = '';
}

module.exports = { mountGrid, thumbsOf, thumbOf, unmountGrid };
