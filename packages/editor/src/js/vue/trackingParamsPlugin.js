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
        <div class="objLabel level1">
          <span class="objLabel level1">
            <span data-bind="text: $root.ut('template', 'Tracking')">Tracking</span>
          </span>
          <div class="propEditor ">
            <span class="propLabel">
              <span data-bind="text: $root.ut('template', 'Tracking')">Tracking URL</span>
            </span>
            <div class="propInput">
              <label>
                <input type="text" />
              </label>
            </div>
          </div>
        </div>
      `,
    });

    new Vue({ el: '#tracking-params' });
  },
};
