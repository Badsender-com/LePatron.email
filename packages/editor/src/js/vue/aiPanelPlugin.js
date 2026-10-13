const Vue = require('vue/dist/vue.common');
const ko = require('knockout');
const axios = require('axios');
const { AiPanel } = require('./components/ai-panel/ai-panel');
const { installRightPanel } = require('../ext/right-panel');
const { createEditorAccess } = require('../ext/ai-panel/editor-access');
const { createAiPanel } = require('../ext/ai-panel/ai-panel-controller');
const {
  fieldTargetOf,
  blockTargetOf,
} = require('../ext/ai-panel/field-target');
const { targetOfBlock } = require('../ext/ai-panel/targets');
const {
  extractBlockTranslatableContent,
} = require('../utils/block-content-extractor');
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
let editor = null;
let viewModel = null;

// The block field an element belongs to (the text being edited).
const fieldOf = (element) =>
  editor &&
  fieldTargetOf(element, {
    pathsOf: (blockId) => editor.textFieldsOf(blockId).map((field) => field.path),
  });

// A block of the canvas, as the toolbar of the block hands it: the block that
// holds the preheader is the preheader's target, as in the panel.
const blockTarget = (block) =>
  targetOfBlock({
    type: () => ko.unwrap(block.type),
    id: () => ko.unwrap(block.id),
  });

// What the targets offer, the email read once for all the block toolbars
// rendered together.
let offers = null;
function offerOnBlocks(target) {
  if (!offers) {
    offers = panel.offerNow();
    setTimeout(() => {
      offers = null;
    });
  }
  return offers(target).actions.length > 0;
}

// Whether a block has any text to work on: cheaper than listing its fields.
const hasText = (block) =>
  Object.keys(extractBlockTranslatableContent(ko.toJS(block))).length > 0;

module.exports = {
  viewModel(vm) {
    // Before bindings: the top bar button and the panel bind to this flag of
    // the editor's one right panel (ext/right-panel.js).
    vm.showAi = installRightPanel(vm, ko).flag('ai');

    // The entry points of the toolbars (#1257). The panel exists once the
    // editor is initialised: the block toolbar re-reads the offer then.
    vm.aiPanelReady = ko.observable(false);
    viewModel = vm;
    // Read in a binding: only the panel's readiness is a dependency, not the
    // content the offer reads, nor the block's own fields.
    vm.offersAiOnBlock = (block) =>
      vm.aiPanelReady() &&
      Boolean(panel) &&
      ko.ignoreDependencies(() => {
        const target = blockTarget(block);
        return (
          (target.kind !== 'block' || hasText(block)) && offerOnBlocks(target)
        );
      });
    vm.openAiOnBlock = (block) => panel && panel.openTarget(blockTarget(block));
    // From the text editor's toolbar: the field it edits, or its block when no
    // text field matches it.
    vm.openAiOnElement = (element) => {
      if (!panel) return;
      const target = fieldOf(element) || blockTargetOf(element);
      if (target) panel.openTarget(target);
    };
  },
  init(vm) {
    // Nothing to offer without an AI action: no panel, no work behind it.
    if (!vm.metadata.hasTextGenerationFeature) return;
    if (!document.getElementById('ai-panel')) return;

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
      editor = null;
    }
    offers = null;
    // Its toolbars offer nothing until a panel exists again.
    if (viewModel) viewModel.aiPanelReady(false);
  },
};
