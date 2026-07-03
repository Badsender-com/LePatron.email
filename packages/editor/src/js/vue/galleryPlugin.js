'use strict';

const Vue = require('vue/dist/vue.common');
const { galleryBridge } = require('../ext/badsender-gallery-bridge');
const Thumb = require('./components/gallery/thumb');
const createGalleryDraggable = require('./directives/gallery-draggable');

// Tab index exposed by Mosaico's `selectedImageTab` observable
const TAB_TEMPLATE = 1;

module.exports = {
  viewModel(vm, ko) {
    // Expose the bridge to Knockout (mirrors badsender-events-hub's
    // `vm.bsEventsHub`) so KO-side code can dispatch GALLERY_REFRESH and
    // listen to GALLERY_IMAGE_SELECTED.
    vm.galleryBridge = galleryBridge;
  },
  init(vm) {
    Vue.component('GalleryPanelPlugin', {
      components: { Thumb },
      directives: { galleryDraggable: createGalleryDraggable(vm) },
      data: () => ({
        mailingImages: [],
        templateImages: [],
        selectedTab: 0,
      }),
      computed: {
        // Active gallery based on the Knockout tab selection
        images() {
          return this.selectedTab === TAB_TEMPLATE
            ? this.templateImages
            : this.mailingImages;
        },
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
        this._subscriptions = [];
      },
      mounted() {
        // Mirror Knockout observableArrays into Vue reactive data. Vue cannot
        // observe KO observables directly, so we snapshot + subscribe.
        this.syncObservable(vm.mailingGallery, 'mailingImages');
        this.syncObservable(vm.templateGallery, 'templateImages');
        if (vm.selectedImageTab) {
          this.selectedTab = vm.selectedImageTab();
          this._subscriptions.push(
            vm.selectedImageTab.subscribe((tab) => {
              this.selectedTab = tab;
            })
          );
        }
        galleryBridge.ready();
      },
      beforeDestroy() {
        this._subscriptions.forEach((sub) => sub.dispose());
      },
      methods: {
        syncObservable(observable, key) {
          if (!observable) return;
          this[key] = observable().slice();
          this._subscriptions.push(
            observable.subscribe((array) => {
              this[key] = array.slice();
            })
          );
        },
        // ISO with the previous grid: click replaces the selected email image
        onSelect(file) {
          vm.addImage(file);
        },
        // ISO with the previous grid: delete the image from the gallery
        onRemove(file) {
          const type = this.selectedTab === TAB_TEMPLATE ? 'template' : 'mailing';
          vm.removeImage(file, type);
        },
      },
      template: `
        <div class="gallery-vue-panel" data-gallery-vue="ready">
          <div class="gallery-vue-panel__count">{{ countLabel }}</div>
          <div class="gallery-vue-grid">
            <thumb
              v-for="file in images"
              :key="file.name"
              v-gallery-draggable="file"
              :file="file"
              @select="onSelect"
              @remove="onRemove"
            />
          </div>
        </div>
      `,
    });

    new Vue({ el: '#gallery-panel' });
  },
};
