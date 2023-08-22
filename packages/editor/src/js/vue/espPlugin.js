const Vue = require('vue/dist/vue.common');
const EspComponent = require('./components/esp/esp-send-mail');
const { TestModalComponent } = require('./components/send-test/test-modal');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component

    Vue.component('EspPlugin', {
      components: {
        EspComponent,
        TestModalComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <esp-form :vm="viewModel"></esp-form>
          <test-modal-component :vm="viewModel"></test-modal-component>
        </div>
      `,
    });

    new Vue({ el: '#espModal' });
  },
};
