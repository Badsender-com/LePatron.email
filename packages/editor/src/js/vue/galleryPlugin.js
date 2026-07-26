'use strict';

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const { RecycleScroller } = require('vue-virtual-scroller');
const { galleryBridge } = require('../ext/badsender-gallery-bridge');
const Thumb = require('./components/gallery/thumb');
const createGalleryDraggable = require('./directives/gallery-draggable');

// Fixed cell size for the virtualised grid. The gallery sidebar has a fixed
// usable width (~364px), so 3 columns of 118px fit with margin to spare.
const GRID_COLUMNS = 3;
const CELL_SIZE = 118;

module.exports = {
  viewModel(vm, ko) {
    // Expose the bridge to Knockout (mirrors badsender-events-hub's
    // `vm.bsEventsHub`) so KO-side code can dispatch GALLERY_REFRESH and
    // listen to GALLERY_IMAGE_SELECTED.
    vm.galleryBridge = galleryBridge;
  },
  init(vm) {
    const GalleryPanel = {
      components: { Thumb, RecycleScroller },
      directives: { galleryDraggable: createGalleryDraggable(vm) },
      props: {
        // 'mailing' or 'template' — one instance per gallery pane
        type: { type: String, required: true },
      },
      data: () => ({
        images: [],
        cellSize: CELL_SIZE,
        gridColumns: GRID_COLUMNS,
      }),
      computed: {
        count() {
          return this.images.length;
        },
        countLabel() {
          const key =
            this.count === 1 ? 'gallery-image-count-one' : 'gallery-image-count';
          return vm.t(key, { count: this.count });
        },
      },
      created() {
        this._subscription = null;
      },
      mounted() {
        // Mirror the Knockout observableArray into Vue reactive data. Vue
        // cannot observe KO observables directly, so we snapshot + subscribe.
        const observable = vm[this.type + 'Gallery'];
        if (observable) {
          this.images = observable().slice();
          this._subscription = observable.subscribe((array) => {
            this.images = array.slice();
          });
        }
        galleryBridge.ready();
      },
      beforeDestroy() {
        if (this._subscription) this._subscription.dispose();
      },
      methods: {
        // ISO with the previous grid: click replaces the selected email image
        onSelect(file) {
          vm.addImage(file);
        },
        // ISO with the previous grid: delete the image from the gallery
        onRemove(file) {
          vm.removeImage(file, this.type);
        },
      },
      template: `
        <div class="gallery-vue-panel" data-gallery-vue="ready">
          <div class="gallery-vue-panel__count">{{ countLabel }}</div>
          <recycle-scroller
            class="gallery-vue-scroller"
            :items="images"
            :item-size="cellSize"
            :grid-items="gridColumns"
            :item-secondary-size="cellSize"
            key-field="name"
            v-slot="{ item }"
          >
            <div class="gallery-vue-cell">
              <thumb
                v-gallery-draggable="item"
                :file="item"
                @select="onSelect"
                @remove="onRemove"
              />
            </div>
          </recycle-scroller>
        </div>
      `,
    };

    // Knockout binding: mount the Vue grid when KO creates the element (the
    // gallery panel lives behind a `ko if: showGallery`, so it is created and
    // destroyed dynamically), and tear it down on disposal.
    ko.bindingHandlers.vueGalleryPanel = {
      init(element, valueAccessor) {
        const type = ko.unwrap(valueAccessor());
        const mountPoint = document.createElement('div');
        element.appendChild(mountPoint);
        const instance = new Vue({
          render: (h) => h(GalleryPanel, { props: { type } }),
        }).$mount(mountPoint);
        ko.utils.domNodeDisposal.addDisposeCallback(element, () => {
          instance.$destroy();
        });
        return { controlsDescendantBindings: true };
      },
    };
  },
};
