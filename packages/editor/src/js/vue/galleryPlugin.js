'use strict';

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const GalleryPanel = require('./components/gallery/panel.js');
const createGalleryDraggable = require('./directives/gallery-draggable');

/**
 * The panel's definition for one Mosaico viewModel: the static options of
 * components/gallery/panel.js, plus what belongs to this editor. Exported so
 * a test drives the real component rather than a copy of it.
 *
 * @param {Object} vm the Mosaico viewModel
 * @returns {Object} Vue component options
 */
function createGalleryPanel(vm) {
  return {
    ...GalleryPanel,
    viewModel: vm,
    // one per editor, shared by its two panes and by every reopening
    remembered: {},
    directives: { galleryDraggable: createGalleryDraggable(vm) },
  };
}

// One panel definition per Mosaico viewModel, built when the first pane of
// that editor mounts.
const panels = new WeakMap();
function panelFor(vm) {
  if (!panels.has(vm)) panels.set(vm, createGalleryPanel(vm));
  return panels.get(vm);
}

// Registered when the module loads, like the bindings of ko-bindings.js, so it
// exists before Mosaico applies its bindings, whether or not the gallery is
// open at that point. The viewModel is the root of the binding context.
ko.bindingHandlers.vueGalleryPanel = {
  init(element, valueAccessor, allBindings, data, bindingContext) {
    const type = ko.unwrap(valueAccessor());
    const Panel = panelFor(bindingContext.$root);
    const mountPoint = document.createElement('div');
    element.appendChild(mountPoint);
    const instance = new Vue({
      render: (h) => h(Panel, { props: { type } }),
    }).$mount(mountPoint);
    ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
      instance.$destroy();
    });
    return { controlsDescendantBindings: true };
  },
};

module.exports = { createGalleryPanel };
