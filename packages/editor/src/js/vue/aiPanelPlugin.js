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
const {
  fieldTargetOf,
  blockTargetOf,
} = require('../ext/ai-panel/field-target');
const { targetOfBlock } = require('../ext/ai-panel/targets');
const { definitionOf } = require('../ext/ai-panel/actions');
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
let viewModel = null;

// The block field an element belongs to (the text being edited): matched
// against the paths of its block's text fields alone, read from the model.
const fieldOf = (element) =>
  editor && fieldTargetOf(element, { pathsOf: editor.textPathsOf });

// What the text editor's toolbar works on: the field it edits, or its block
// when no text field matches it.
const elementTarget = (element) => fieldOf(element) || blockTargetOf(element);

// A block of the canvas, as the toolbar of the block hands it: the block that
// holds the preheader is the preheader's target, as in the panel.
const blockTarget = (block) =>
  targetOfBlock({
    type: () => ko.unwrap(block.type),
    id: () => ko.unwrap(block.id),
  });

/**
 * What the entry point of a toolbar says on a target, from the action registry
 * alone: the name of its single action, « Outils IA » for a list, and null
 * when it offers nothing.
 *
 * Read in a binding, the email the registry decides from is no dependency (the
 * context is built outside of it); what the registry asks of the target itself
 * is: a block's text, through `blockHasText`.
 */
function entryLabelOn(target) {
  if (!viewModel || !viewModel.aiPanelReady() || !panel || !target) {
    return null;
  }
  const offerOf = ko.ignoreDependencies(panel.offerNow);
  const { actions, opens } = offerOf(target);
  if (opens === 'none') return null;
  if (opens === 'list') return viewModel.t('ai-panel-title');
  const { labels } = definitionOf(actions[0].id);
  return viewModel.t(labels.entry || labels.name);
}

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
    viewModel = vm;

    // The block toolbar's AI tool: shown while the registry offers the block
    // something, re-read when the panel comes or goes and when the block's
    // text changes (an alternative text typed in).
    vm.offersAiOnBlock = (block) => Boolean(entryLabelOn(blockTarget(block)));
    // Its title and accessible name, read together.
    vm.aiBlockToolAttributes = (block) => {
      const label = entryLabelOn(blockTarget(block));
      return { title: label, 'aria-label': label };
    };
    // The block is selected first, as its other tools do (their click reaches
    // the block); a click on this one stops there, and a key reaches nothing.
    vm.openAiOnBlock = (block) => {
      if (!panel) return;
      vm.selectBlock(block);
      panel.openTarget(blockTarget(block));
    };
    vm.openAiOnBlockByKey = (block, event) => {
      if (event.key !== 'Enter' && event.key !== ' ') return true;
      event.preventDefault();
      vm.openAiOnBlock(block);
      return false;
    };

    // The text editor's AI button, for the element it edits.
    vm.aiLabelOnElement = (element) =>
      entryLabelOn(element && elementTarget(element));
    vm.openAiOnElement = (element) => {
      if (!panel) return;
      const target = elementTarget(element);
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
    // Its toolbars offer nothing until a panel exists again.
    if (viewModel) viewModel.aiPanelReady(false);
  },
};
