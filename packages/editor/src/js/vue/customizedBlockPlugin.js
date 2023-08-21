const Vue = require('vue/dist/vue.common');
const {
  SaveBlockModalComponent,
} = require('./components/save-block-modal/save-modal');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    // Init VueJS component

    Vue.component('CustomizedBlockPlugin', {
      components: {
        SaveBlockModalComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <save-block-modal :vm="viewModel"></save-block-modal>
        </div>
      `,
    });

    new Vue({ el: '#customizedBlockModal' });
  },
};
