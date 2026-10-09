'use strict';

const Vue = require('vue/dist/vue.common');
const { definitionOf } = require('../../../ext/ai-panel/actions');
const { placeFieldIcons } = require('../../../ext/ai-panel/field-icons');
const { FIELD_TARGETS } = require('../../../ext/ai-panel/targets');
const { AiProposalsSteps } = require('./ai-proposals-steps');
const template = require('./ai-panel.template');

// The component that renders the steps of each family of AI actions.
const STEPS_BY_FAMILY = {
  proposals: 'AiProposalsSteps',
};

// What the controller holds, mirrored here so Vue renders it.
const MIRRORED = [
  'target',
  'actions',
  'targetActions',
  'session',
  'sessionAction',
  'selectionChanged',
];

/**
 * The AI panel, « Outils IA » (ADR 0004). Its state and decisions are the
 * controller's (ext/ai-panel/ai-panel-controller.js): this renders the lists
 * and hands the action under way to the component of its family. Its place,
 * Escape and the focus on open and close are the right panel's
 * (ext/right-panel.js); it also places the AI icons on the fields.
 */
const AiPanel = Vue.component('AiPanel', {
  components: { AiProposalsSteps },
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
    subscriptions: [],
    iconsObserver: null,
  }),
  created() {
    this.sync();
    this.subscriptions = MIRRORED.map((name) =>
      this.panel[name].subscribe(() => this.sync(name))
    );
  },
  mounted() {
    this.watchFieldIcons();
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
    if (this.iconsObserver) this.iconsObserver.disconnect();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    sync(changed) {
      MIRRORED.forEach((name) => {
        this[name] = this.panel[name]();
      });
      if (changed === 'session') {
        this.sessionKey += 1;
        this.liveMessage = '';
        this.focusHeading();
      }
    },
    labelsOf(id) {
      return definitionOf(id).labels;
    },
    stepsOf(session) {
      return STEPS_BY_FAMILY[definitionOf(session.state.action).family];
    },
    focusHeading() {
      this.$nextTick(() => {
        if (this.$refs.heading) this.$refs.heading.focus();
      });
    },
    refresh() {
      this.panel.refresh();
    },
    showList(target) {
      this.panel.showList(target);
      this.focusHeading();
    },
    openAction(id, target) {
      this.panel.openAction(id, target);
    },
    announce(message) {
      this.liveMessage = message;
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
    close() {
      this.vm.showAi(false);
    },
  },
  template,
});

module.exports = { AiPanel };
