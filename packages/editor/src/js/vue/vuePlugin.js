var Vue = require('vue/dist/vue.common');
var EspComponent = require('./components/esp/esp-send-mail');

module.exports = {
  viewModel(vm, ko) {
  },
  init(vm) {
    // Init VueJS component
    Vue.component('app-vue', {
      components: {
        EspComponent
      },
      template: `
          <esp-form :vm="viewModel"></esp-form>
      `,
      data: () => ({
        viewModel: vm,
      }),
      mounted() {
      },
    })

    new Vue({ el: '#toolVue' });
  },
};
