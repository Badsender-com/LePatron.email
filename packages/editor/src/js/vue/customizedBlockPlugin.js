const Vue = require('vue/dist/vue.common');
const {
  SaveBlockModalComponent,
} = require('./components/save-block-modal/save-modal');
const {
  DeleteBlockModalComponent,
} = require('./components/delete-block-modal/delete.modal');
const {
  TranslateBlockModalComponent,
} = require('./components/translate-block-modal/translate-block-modal');
const {
  ContentFeedModalComponent,
} = require('./components/content-feed-modal/content-feed-modal');
const {
  TextGenBlockModalComponent,
} = require('./components/textgen-block-modal/textgen-block-modal');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {

    Vue.component('CustomizedBlockPlugin', {
      components: {
        SaveBlockModalComponent,
        DeleteBlockModalComponent,
        TranslateBlockModalComponent,
        ContentFeedModalComponent,
        TextGenBlockModalComponent,
      },
      data: () => ({
        viewModel: vm,
      }),
      template: `
        <div>
          <save-block-modal :vm="viewModel"></save-block-modal>
          <delete-block-modal :vm="viewModel"></delete-block-modal>
          <translate-block-modal :vm="viewModel"></translate-block-modal>
          <content-feed-modal :vm="viewModel"></content-feed-modal>
          <textgen-block-modal :vm="viewModel"></textgen-block-modal>
        </div>
      `,
    });

    new Vue({ el: '#customizedBlockModal' });
  },
};
