/**
 * @jest-environment jsdom
 */
'use strict';

// The `vueGalleryPanel` Knockout binding mounts the Vue panel in each gallery
// pane of toolbox.tmpl.html. Driven through ko.applyBindings on real markup,
// as Mosaico does, rather than by calling the handler by hand.
jest.mock('jquery-ui/ui/widgets/draggable', () => ({}), { virtual: true });
require('./helpers/intersection-observer');

const Vue = require('vue/dist/vue.common');
const $ = require('jquery');
const ko = require('knockout');
require('../../packages/editor/src/js/vue/galleryPlugin.js');

// the real widget is installed on jQuery by the gulp build, not by Node
$.fn.draggable = function draggable() {
  return this;
};

const IMAGES = [
  { name: 'a-1.jpg', label: 'un.jpg', thumbnailUrl: '/t/a-1.jpg' },
  { name: 'a-2.png', label: 'deux.png', thumbnailUrl: '/t/a-2.png' },
];

// The same shape as the gallery pane: the host sits behind `ko if` on the
// gallery being open, which destroys and recreates it.
const MARKUP = `
  <!-- ko if: showGallery -->
  <div data-pane="mailing" data-bind="vueGalleryPanel: 'mailing'"></div>
  <div data-pane="template" data-bind="vueGalleryPanel: 'template'"></div>
  <!-- /ko -->`;

function fakeViewModel(showGallery) {
  return {
    t: (key, params) => (params ? `${key}:${params.count}` : key),
    addImage() {},
    removeImage() {},
    showGallery: ko.observable(showGallery),
    mailingGallery: ko.observableArray(IMAGES.slice()),
    mailingGalleryStatus: ko.observable(IMAGES.length),
    templateGallery: ko.observableArray([]),
    templateGalleryStatus: ko.observable(0),
  };
}

function apply(vm) {
  const root = document.createElement('div');
  root.innerHTML = MARKUP;
  document.body.appendChild(root);
  ko.applyBindings(vm, root);
  return root;
}

const pane = (root, type) =>
  root.querySelector(`[data-pane="${type}"] .gallery-vue-panel`);

// The panel component. It shares its element with the bare Vue root the
// binding mounts it under, and `__vue__` names whichever rendered last.
const panelOf = (root, type) => {
  const instance = pane(root, type).__vue__;
  return instance.$props && instance.$props.type
    ? instance
    : instance.$children[0];
};

describe('vueGalleryPanel binding', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('is registered as soon as the module loads, before any binding is applied', () => {
    expect(typeof ko.bindingHandlers.vueGalleryPanel.init).toBe('function');
  });

  // The case that broke when the handler was registered in the plugin's
  // `init` hook, which runs after Mosaico's ko.applyBindings.
  it('mounts a panel per pane when the gallery is open as bindings apply', () => {
    const root = apply(fakeViewModel(true));
    expect(pane(root, 'mailing')).not.toBeNull();
    expect(pane(root, 'template')).not.toBeNull();
    ko.cleanNode(root);
  });

  it('mounts when the gallery opens, reading the viewModel from the binding context', async () => {
    const vm = fakeViewModel(false);
    const root = apply(vm);
    expect(pane(root, 'mailing')).toBeNull();

    vm.showGallery(true);
    expect(pane(root, 'mailing')).not.toBeNull();
    await Vue.nextTick();
    // the count comes from this viewModel's own gallery
    expect(
      pane(root, 'mailing').querySelector('.gallery-vue-panel__count')
        .textContent
    ).toBe('gallery-image-count:2');
    ko.cleanNode(root);
  });

  // Knockout must leave the Vue markup alone: `{{ countLabel }}` or a
  // `:class` it tried to bind would throw, or be left as raw text.
  it('keeps Knockout out of the Vue markup', async () => {
    const root = apply(fakeViewModel(true));
    await Vue.nextTick();
    const host = root.querySelector('[data-pane="mailing"]');
    expect(host.innerHTML).not.toContain('{{');
    expect(host.querySelectorAll('.gallery-thumb').length).toBeGreaterThan(0);
    ko.cleanNode(root);
  });

  it('destroys the panel, and its subscriptions, when the gallery closes', () => {
    const vm = fakeViewModel(true);
    const root = apply(vm);
    expect(vm.mailingGallery.getSubscriptionsCount()).toBe(1);

    vm.showGallery(false);
    expect(pane(root, 'mailing')).toBeNull();
    expect(vm.mailingGallery.getSubscriptionsCount()).toBe(0);
    expect(vm.mailingGalleryStatus.getSubscriptionsCount()).toBe(0);
    ko.cleanNode(root);
  });

  // The gallery closes on every block selection and its panes are rebuilt
  // when it reopens for the next placeholder: the search must survive that.
  it('gives each pane back its search, format and sort when the gallery reopens', async () => {
    const vm = fakeViewModel(true);
    const root = apply(vm);
    const panel = () => panelOf(root, 'mailing');
    Object.assign(panel(), { search: 'un', format: 'jpg', sortBy: 'date_asc' });
    await Vue.nextTick();

    vm.showGallery(false);
    vm.showGallery(true);
    await Vue.nextTick();
    expect(panel().search).toBe('un');
    expect(panel().format).toBe('jpg');
    expect(panel().sortBy).toBe('date_asc');
    expect(
      pane(root, 'mailing').querySelector('[data-gallery-search]').value
    ).toBe('un');
    // each pane keeps its own
    expect(panelOf(root, 'template').search).toBe('');
    ko.cleanNode(root);
  });

  it('starts another editor with no search', () => {
    const root = apply(fakeViewModel(true));
    expect(panelOf(root, 'mailing').search).toBe('');
    ko.cleanNode(root);
  });
});
