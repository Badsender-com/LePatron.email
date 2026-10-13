const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const axios = require('axios');
const { AiPanel } = require('./components/ai-panel/ai-panel');
const { installRightPanel } = require('../ext/right-panel');
const { createEditorAccess } = require('../ext/ai-panel/editor-access');
const { createAiPanel } = require('../ext/ai-panel/ai-panel-controller');
const {
  canUseTextGeneration,
} = require('../ext/ai-panel/text-generation-access');
const { fieldTargetOf } = require('../ext/ai-panel/field-target');
const {
  generateSubjects,
  generatePreheaders,
  correctText,
} = require('./utils/apis');

// The text generation routes the AI actions call, by route name.
const ROUTES = {
  subject: generateSubjects,
  preheader: generatePreheaders,
  corrections: correctText,
};

const api = {
  generate: (route, body) =>
    axios.post(ROUTES[route](), body).then((response) => response.data),
};

let app = null;
let panel = null;
// The view model the panel waits for the current user of: a template swapped
// in the meantime mounts nothing for the one it left.
let pending = null;
let editor = null;

// The block field an element belongs to (the text being edited).
const fieldOf = (element) =>
  editor &&
  fieldTargetOf(element, {
    pathsOf: (blockId) =>
      editor.textFieldsOf(blockId).map((field) => field.path),
  });

// A block of the canvas, as the toolbar of the block hands it.
const blockTarget = (block) => ({
  kind: 'block',
  blockId: ko.unwrap(block.id),
  blockType: ko.unwrap(block.type),
});

function mount(vm) {
  editor = createEditorAccess(vm);
  panel = createAiPanel({
    ko,
    editor,
    api,
    isOpen: vm.showAi,
    selection: vm.selectedBlock,
    // A click in a text selects it: the field being edited is the element
    // that has the focus, matched against its block's text fields.
    fieldSelection: vm.selectedItem,
    editedField: () => fieldOf(document.activeElement),
  });
  vm.aiPanelReady(true);

  Vue.component('AiPanelPlugin', {
    components: { AiPanel },
    data: () => ({ viewModel: vm, panel }),
    template: '<ai-panel :vm="viewModel" :panel="panel"></ai-panel>',
  });

  app = new Vue({ el: '#ai-panel' });
}

module.exports = {
  viewModel(vm) {
    // Before bindings: the top bar button and the panel bind to this flag of
    // the editor's one right panel (ext/right-panel.js).
    vm.showAi = installRightPanel(vm, ko).flag('ai');
    // The condition of the top bar button, the same as the panel's.
    vm.canUseTextGeneration = () => canUseTextGeneration(vm);

    // The entry points of the toolbars (#1257). The panel exists once the
    // editor is initialised: the block toolbar re-reads the offer then.
    vm.aiPanelReady = ko.observable(false);
    vm.offersAiOnBlock = (block) =>
      vm.aiPanelReady() &&
      panel.offerNow()(blockTarget(block)).actions.length > 0;
    vm.openAiOnBlock = (block) => panel && panel.openTarget(blockTarget(block));
    // From the text editor's toolbar: the field it edits.
    vm.openAiOnElement = (element) => {
      const target = panel && fieldOf(element);
      if (target) panel.openTarget(target);
    };
  },
  init(vm) {
    if (!document.getElementById('ai-panel')) return;
    // The rights come with the current user, loaded after the editor starts.
    // Nothing to offer without an AI action for this user on this email: no
    // panel, no work behind it.
    pending = vm;
    const mountIfAllowed = () => {
      if (pending !== vm) return;
      pending = null;
      if (canUseTextGeneration(vm)) mount(vm);
    };
    if (typeof vm.whenCurrentUser === 'function') {
      vm.whenCurrentUser(mountIfAllowed);
    } else {
      mountIfAllowed();
    }
  },
  // Called by the template loader when the editor swaps templates: the panel
  // lets go of the view model it subscribed to.
  dispose() {
    pending = null;
    if (app) {
      app.$destroy();
      app = null;
    }
    if (panel) {
      panel.dispose();
      panel = null;
      editor = null;
    }
  },
};
