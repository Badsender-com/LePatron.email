const Vue = require('vue/dist/vue.common');
const {
  PersonalizedBlocksListComponent,
} = require('./components/personalized-blocks-list/personalized-blocks-list-component');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {
    Vue.component('PersonalizedBlocksPlugin', {
      components: {
        PersonalizedBlocksListComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <personalized-blocks-list-component :vm="viewModel"></personalized-blocks-list-component>
        </div>
      `,
    });

    new Vue({ el: '#personalizedBlocksPlugin' });
  },
};
