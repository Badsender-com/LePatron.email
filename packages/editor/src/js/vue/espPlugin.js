const Vue = require('vue/dist/vue.common');
const EspComponent = require('./components/esp/esp-send-mail');
const { TestModalComponent } = require('./components/send-test/test-modal');
const {
  ImageHostExportModalComponent,
} = require('./components/image-host-export/image-host-export-modal');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component

    Vue.component('EspPlugin', {
      components: {
        EspComponent,
        TestModalComponent,
        ImageHostExportModalComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <esp-form :vm="viewModel"></esp-form>
          <test-modal-component :vm="viewModel"></test-modal-component>
          <image-host-export-modal-component :vm="viewModel"></image-host-export-modal-component>
        </div>
      `,
    });

    new Vue({ el: '#espModal' });
  },
};
