'use strict';

const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const { RecycleScroller } = require('vue-virtual-scroller');
const { galleryBridge } = require('../ext/badsender-gallery-bridge');
const Thumb = require('./components/gallery/thumb');
const createGalleryDraggable = require('./directives/gallery-draggable');
const {
  filterGalleryFiles,
} = require('../../../../shared/gallery/filter.js');

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
        search: '',
        cellSize: CELL_SIZE,
        gridColumns: GRID_COLUMNS,
      }),
      computed: {
        // `images` stays the untouched mirror of the Knockout observable —
        // Mosaico keeps mutating that one on upload and delete. Searching only
        // derives from it, so a filter can never desynchronise the grid from
        // the list the rest of the editor works with.
        visibleImages() {
          return filterGalleryFiles(this.images, { search: this.search });
        },
        count() {
          return this.visibleImages.length;
        },
        isSearching() {
          return this.search.trim() !== '';
        },
        hasNoResult() {
          return this.isSearching && this.count === 0;
        },
        countLabel() {
          const key =
            this.count === 1 ? 'gallery-image-count-one' : 'gallery-image-count';
          return vm.t(key, { count: this.count });
        },
        searchPlaceholder() {
          return vm.t('gallery-search-placeholder');
        },
        clearSearchLabel() {
          return vm.t('gallery-search-clear');
        },
        noResultLabel() {
          return vm.t('gallery-search-no-result');
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
        clearSearch() {
          this.search = '';
          // give the field back to the user: clearing is usually a retry
          this.$nextTick(() => {
            if (this.$refs.searchInput) this.$refs.searchInput.focus();
          });
        },
      },
      template: `
        <div class="gallery-vue-panel" data-gallery-vue="ready">
          <div class="gallery-vue-search">
            <span class="lucide lucide-search gallery-vue-search__icon"></span>
            <input
              ref="searchInput"
              v-model="search"
              type="search"
              class="gallery-vue-search__input"
              data-gallery-search
              :placeholder="searchPlaceholder"
              :aria-label="searchPlaceholder"
            />
            <button
              v-if="isSearching"
              type="button"
              class="gallery-vue-search__clear"
              :title="clearSearchLabel"
              :aria-label="clearSearchLabel"
              @click="clearSearch"
            >
              <span class="lucide lucide-x"></span>
            </button>
          </div>
          <div class="gallery-vue-panel__count">{{ countLabel }}</div>
          <p
            v-if="hasNoResult"
            class="gallery-vue-panel__empty"
            data-gallery-no-result
          >{{ noResultLabel }}</p>
          <recycle-scroller
            v-else
            class="gallery-vue-scroller"
            :items="visibleImages"
            :item-size="cellSize"
            :grid-items="gridColumns"
            :item-secondary-size="cellSize"
            key-field="name"
            v-slot="{ item, index }"
          >
            <!-- the scroller recycles its views, so DOM order is pool order,
                 not list order: the index is the only reliable handle on
                 position, for tests and for anything reading the grid -->
            <div class="gallery-vue-cell" :data-gallery-index="index">
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
