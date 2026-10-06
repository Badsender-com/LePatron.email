const Vue = require('vue/dist/vue.common');
const { AiPanel } = require('./components/ai-panel/ai-panel');
const { installRightPanel } = require('../ext/right-panel');

module.exports = {
  viewModel(vm, ko) {
    // Before bindings: the top bar button and the panel bind to this flag of
    // the editor's one right panel (ext/right-panel.js).
    vm.showAi = installRightPanel(vm, ko).flag('ai');
  },
  init(vm) {
    if (!document.getElementById('ai-panel')) return;
    Vue.component('AiPanelPlugin', {
      components: { AiPanel },
      data: () => ({ viewModel: vm }),
      template: '<ai-panel :vm="viewModel"></ai-panel>',
    });

    new Vue({ el: '#ai-panel' });
  },
};
