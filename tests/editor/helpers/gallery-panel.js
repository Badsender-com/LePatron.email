'use strict';

// The gallery panel mounted detached, on a stand-in for the Mosaico
// viewModel. Detached, the scroller renders no rows: these suites read the
// panel's own state and markup; gallery-grid.js mounts one in the document
// for its thumbnails. The suite mocks `jquery-ui/ui/widgets/draggable`
// before requiring this.
require('./intersection-observer');

const Vue = require('vue/dist/vue.common');
const $ = require('jquery');
const ko = require('knockout');
const {
  createGalleryPanel,
} = require('../../../packages/editor/src/js/vue/galleryPlugin.js');

// the real widget is installed on jQuery by the gulp build, not by Node
$.fn.draggable = function draggable() {
  return this;
};

const IMAGES = [
  {
    name: 'a-1.jpg',
    label: 'un.jpg',
    thumbnailUrl: '/api/images/cover/111x111/a-1.jpg',
  },
  {
    name: 'a-2.png',
    label: 'deux.png',
    thumbnailUrl: '/api/images/cover/111x111/a-2.png',
  },
];

// The Mosaico viewModel as the panel sees it, with real Knockout observables
// so the mirror is exercised through its subscription. A loaded gallery
// reports its image count as status.
function fakeViewModel(images, status = images.length) {
  return {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage() {},
    removeImage() {},
    mailingGallery: ko.observableArray(images),
    mailingGalleryStatus: ko.observable(status),
  };
}

function mountVm(vm, type = 'mailing') {
  const Panel = Vue.extend(createGalleryPanel(vm));
  return new Panel({ propsData: { type } }).$mount();
}

function mount(images, status) {
  return mountVm(fakeViewModel(images, status));
}

module.exports = { IMAGES, fakeViewModel, mountVm, mount };
