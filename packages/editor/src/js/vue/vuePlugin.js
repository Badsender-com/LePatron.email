const Vue = require('vue/dist/vue.common');
const EspComponent = require('./components/esp/esp-send-mail');

module.exports = {
  viewModel(vm, ko) {
  },
  init(vm) {
    // Init VueJS component
    Vue.component('AppVue', {
      components: {
        EspComponent
      },
      data: () => ({
        viewModel: vm,
      }),
      mounted() {
      },
      template: `
          <esp-form :vm="viewModel"></esp-form>
      `,
    })

    new Vue({ el: '#espModal' });
  },
};
