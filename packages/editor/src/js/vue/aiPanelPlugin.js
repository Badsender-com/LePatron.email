const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const axios = require('axios');
const { AiPanel } = require('./components/ai-panel/ai-panel');
const { installRightPanel } = require('../ext/right-panel');
const { createEditorAccess } = require('../ext/ai-panel/editor-access');
const { createAiPanel } = require('../ext/ai-panel/ai-panel-controller');
const { generateSubjects, generatePreheaders } = require('./utils/apis');

// The text generation routes the "proposals" actions call, by route name.
const ROUTES = { subject: generateSubjects, preheader: generatePreheaders };

const api = {
  generate: (route, body) =>
    axios.post(ROUTES[route](), body).then((response) => response.data),
};

let app = null;
let panel = null;

module.exports = {
  viewModel(vm) {
    // Before bindings: the top bar button and the panel bind to this flag of
    // the editor's one right panel (ext/right-panel.js).
    vm.showAi = installRightPanel(vm, ko).flag('ai');
  },
  init(vm) {
    // Nothing to offer without an AI action: no panel, no work behind it.
    if (!vm.metadata.hasTextGenerationFeature) return;
    if (!document.getElementById('ai-panel')) return;

    panel = createAiPanel({
      ko,
      editor: createEditorAccess(vm),
      api,
      isOpen: vm.showAi,
      selection: vm.selectedBlock,
    });

    Vue.component('AiPanelPlugin', {
      components: { AiPanel },
      data: () => ({ viewModel: vm, panel }),
      template: '<ai-panel :vm="viewModel" :panel="panel"></ai-panel>',
    });

    app = new Vue({ el: '#ai-panel' });
  },
  // Called by the template loader when the editor swaps templates: the panel
  // lets go of the view model it subscribed to.
  dispose() {
    if (app) {
      app.$destroy();
      app = null;
    }
    if (panel) {
      panel.dispose();
      panel = null;
    }
  },
};
