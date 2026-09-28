const Vue = require('vue/dist/vue.common');
const EspComponent = require('./components/esp/esp-send-mail');

// Sending a test is no longer a modal: it is a tab of the quality drawer
// (vue/components/quality-drawer/send-test-panel.js).
module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component

    Vue.component('EspPlugin', {
      components: {
        EspComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <esp-form :vm="viewModel"></esp-form>
        </div>
      `,
    });

    new Vue({ el: '#espModal' });
  },
};
