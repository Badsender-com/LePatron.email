const Vue = require('vue/dist/vue.common');
const EspComponent = require('./components/esp/esp-send-mail');
const { TestModalComponent } = require('./components/send-test/test-modal');
const { SaveBlockModalComponent } = require('./components/save-block-modal/save-modal');


module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component

    Vue.component('EspPlugin', {
      components: {
        EspComponent,
        TestModalComponent,
        SaveBlockModalComponent
      },
      data: () => ({
        viewModel: vm,
      }),
      mounted() {

      },
      template: `
        <div>
          <esp-form :vm="viewModel"></esp-form>
          <test-modal-component :vm="viewModel"></test-modal-component>
          <save-block-modal :vm="viewModel"></save-block-modal>
          </div>
      `,
    });

    new Vue({ el: '#espModal' });
  },
};
