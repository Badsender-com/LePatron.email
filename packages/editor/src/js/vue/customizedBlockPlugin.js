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
  HtmlCodeModalComponent,
} = require('./components/html-code-modal/html-code-modal');

module.exports = {
  viewModel(vm, ko) {},
  init(vm) {

    Vue.component('CustomizedBlockPlugin', {
      components: {
        SaveBlockModalComponent,
        DeleteBlockModalComponent,
        TranslateBlockModalComponent,
        ContentFeedModalComponent,
        HtmlCodeModalComponent,
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
          <html-code-modal :vm="viewModel"></html-code-modal>
        </div>
      `,
    });

    new Vue({ el: '#customizedBlockModal' });
  },
};
