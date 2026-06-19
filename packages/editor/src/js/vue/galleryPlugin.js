'use strict';

const Vue = require('vue/dist/vue.common');
const { galleryBridge } = require('../ext/badsender-gallery-bridge');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    Vue.component('GalleryPanelPlugin', {
      data: () => ({
        selectedTab: null,
      }),
      created() {
        this._selectedTabSubscription = null;
      },
      mounted() {
        // Read initial active tab from Knockout observable
        if (vm.selectedImageTab) {
          this.selectedTab = vm.selectedImageTab();
          this._selectedTabSubscription = vm.selectedImageTab.subscribe((tab) => {
            this.selectedTab = tab;
          });
        }
        galleryBridge.ready();
      },
      beforeDestroy() {
        if (this._selectedTabSubscription) {
          this._selectedTabSubscription.dispose();
        }
      },
      template: `
        <div class="gallery-vue-panel" data-gallery-vue="ready" style="display:none">
          <!-- placeholder: replaced by full gallery in US-05 -->
        </div>
      `,
    });

    new Vue({ el: '#gallery-panel' });
  },
};
