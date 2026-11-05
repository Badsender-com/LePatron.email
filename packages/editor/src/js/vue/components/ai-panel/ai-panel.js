'use strict';

const Vue = require('vue/dist/vue.common');
const { definitionOf } = require('../../../ext/ai-panel/actions');
const { placeFieldIcons } = require('../../../ext/ai-panel/field-icons');
const { FIELD_TARGETS } = require('../../../ext/ai-panel/targets');
const { AiProposalsSteps } = require('./ai-proposals-steps');
const { AiCorrectionsSteps } = require('./ai-corrections-steps');
const template = require('./ai-panel.template');
const koMirror = require('../../mixins/ko-mirror');
const { RightPanelShell } = require('../right-panel/right-panel-shell');

// The component that renders the steps of each family of AI actions.
const STEPS_BY_FAMILY = {
  proposals: 'AiProposalsSteps',
  corrections: 'AiCorrectionsSteps',
};

// What the controller holds, mirrored here so Vue renders it.
const MIRRORED = [
  'target',
  'actions',
  'targetActions',
  'sessionAction',
  'selectionChanged',
];

/**
 * The AI panel, « Outils IA » (ADR 0010). Its state and decisions are the
 * controller's (ext/ai-panel/ai-panel-controller.js): this renders the lists
 * and hands the action under way to the component of its family. Its place,
 * Escape and the focus on open and close are the right panel's
 * (ext/right-panel.js); it also places the AI icons on the fields.
 */
const AiPanel = Vue.component('AiPanel', {
  components: { AiProposalsSteps, AiCorrectionsSteps, RightPanelShell },
  mixins: [koMirror],
  props: {
    vm: { type: Object, required: true },
    panel: { type: Object, required: true },
  },
  data: () => ({
    target: null,
    actions: [],
    targetActions: [],
    session: null,
    sessionAction: null,
    selectionChanged: null,
    // A new key for each session: its steps start afresh.
    sessionKey: 0,
    // Said to screen readers: proposals arrived, copied, undone.
    liveMessage: '',
    // The main buttons of the steps under way, in the panel's foot (boards
    // a3 to a5): [{ id, label, primary?, disabled? }], said by the steps.
    footer: [],
  }),
  created() {
    this.iconsObserver = null;
    MIRRORED.forEach((name) =>
      this.mirror(this.panel[name], (value) => (this[name] = value))
    );
    // A session that changes starts its steps afresh.
    this.mirror(
      this.panel.session,
      (value) => (this.session = value),
      () => this.startSession()
    );
  },
  mounted() {
    this.watchFieldIcons();
  },
  beforeDestroy() {
    if (this.iconsObserver) this.iconsObserver.disconnect();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    // The session changed: its steps start afresh, the heading takes the focus.
    startSession() {
      this.sessionKey += 1;
      this.liveMessage = '';
      this.footer = [];
      this.focusHeading();
    },
    // A button of the foot: the steps that named it carry it out.
    onFooter(id) {
      const steps = this.$refs.steps;
      if (steps && typeof steps.onFooter === 'function') steps.onFooter(id);
    },
    labelsOf(id) {
      return definitionOf(id).labels;
    },
    // The name an action takes on its target: « Corriger ce champ », « ce
    // bloc », « tout l'email » (board a2).
    nameOf(id, target) {
      const { labels } = definitionOf(id);
      const kind = target && target.kind;
      return this.t((labels.byKind && labels.byKind[kind]) || labels.name);
    },
    descriptionOf(id, target) {
      const { labels } = definitionOf(id);
      const kind = target && target.kind;
      const key =
        (labels.describeByKind && labels.describeByKind[kind]) ||
        labels.description;
      return key ? this.t(key) : '';
    },
    iconOf(id) {
      return definitionOf(id).icon || 'lucide-bot';
    },
    // The block a target is on, as the comments name it.
    blockOf(target) {
      if (!target || !target.blockId) return '';
      return typeof this.vm.commentBlockLabel === 'function'
        ? this.vm.commentBlockLabel(target.blockId)
        : '';
    },
    stepsOf(session) {
      return STEPS_BY_FAMILY[definitionOf(session.state.action).family];
    },
    focusHeading() {
      if (this.$refs.shell) this.$refs.shell.focusTitle();
    },
    refresh() {
      this.panel.refresh();
    },
    // Back to the list: the session ends, and its change gives the focus to
    // the title (startSession).
    showList(target) {
      this.panel.showList(target);
    },
    openAction(id, target) {
      this.panel.openAction(id, target);
    },
    // Emptied first: the same message twice is said twice.
    announce(message) {
      this.liveMessage = '';
      this.$nextTick(() => {
        this.liveMessage = message;
      });
    },
    // The subject and preheader fields re-render (Vue, Knockout): the icons are
    // placed again on every change of the toolbox, never twice; the email is
    // read once for all of them.
    watchFieldIcons() {
      const root = document.getElementById('main-toolbox');
      if (!root) return;
      let pending = null;
      const place = () => {
        pending = null;
        placeFieldIcons(root, {
          actionsFor: this.panel.offerNow(),
          onOpen: this.panel.openTarget,
          labelFor: (kind) => this.t(FIELD_TARGETS[kind].labelKey),
        });
      };
      this.iconsObserver = new MutationObserver(() => {
        if (!pending) pending = setTimeout(place, 100);
      });
      this.iconsObserver.observe(root, { childList: true, subtree: true });
      place();
    },
  },
  template,
});

module.exports = { AiPanel };
