const Vue = require('vue/dist/vue.common');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component
    Vue.component('TrackingParamsPlugin', {
      components: {
      },
      data: () => ({
        viewModel: vm,
      }),
      mounted() {
      },
      template: `
        <div>
          Code goes here
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
