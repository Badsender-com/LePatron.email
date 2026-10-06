'use strict';

const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const { generateSubjects, generatePreheaders } = require('../../utils/apis');
const {
  availableActions,
  ACTIONS,
} = require('../../../ext/ai-panel/action-registry');
const {
  createActionSession,
} = require('../../../ext/ai-panel/action-session');
const { createEditorAccess } = require('../../../ext/ai-panel/editor-access');
const template = require('./ai-panel.template');

const ROUTES = { subject: generateSubjects, preheader: generatePreheaders };

const api = {
  generate: (kind, body) =>
    axios.post(ROUTES[kind](), body).then((response) => response.data),
};

// The words of each action, in the list and at the head of its steps.
const LABELS = {
  [ACTIONS.SUBJECT]: {
    name: 'ai-panel-action-subject',
    proposals: 'text-generation-subjects-title',
    copyHint: 'text-generation-copy-hint',
    applied: 'text-generation-applied-subject',
  },
  [ACTIONS.PREHEADER]: {
    name: 'ai-panel-action-preheader',
    proposals: 'text-generation-preheaders-title',
    copyHint: 'text-generation-copy-hint-preheader',
    applied: 'text-generation-applied-preheader',
  },
};

/**
 * The AI panel, « Outils IA » (ADR 0004): the actions that need no target,
 * then the steps of the action the user picked. The steps themselves live in
 * an action session (ext/ai-panel/action-session.js); this only renders them.
 * Its place, Escape and focus are the right panel's (ext/right-panel.js).
 */
const AiPanel = Vue.component('AiPanel', {
  props: {
    vm: { type: Object, required: true },
  },
  data: () => ({
    // The actions of the whole email, read from the email on every open.
    actions: [],
    // The action under way, or null for the list.
    session: null,
    // The user chose to go on without a subject.
    goOnAnyway: false,
    brief: '',
    copiedIndex: null,
    copyError: false,
    subscription: null,
  }),
  computed: {
    action() {
      if (!this.session) return null;
      return this.actions.find((a) => a.id === this.session.state.action);
    },
    labels() {
      return this.session ? LABELS[this.session.state.action] : null;
    },
    state() {
      return this.session ? this.session.state : null;
    },
    // The strong suggestion to write the subject first (preheader only).
    urgesSubjectFirst() {
      return Boolean(
        this.action &&
          this.action.suggestFirst &&
          !this.goOnAnyway &&
          !this.state.proposals.length
      );
    },
    canApply() {
      return Boolean(this.action && this.action.canApply);
    },
    picked() {
      return this.state && this.state.proposals[this.state.selectedIndex];
    },
    appliedText() {
      const { applied } = this.state || {};
      return applied ? Object.values(applied)[0] : '';
    },
  },
  created() {
    this.editor = createEditorAccess(this.vm);
    // For the AI icons on the fields (#1182): open the panel on an action.
    this.vm.aiPanel = { openAction: this.openAction, showList: this.showList };
  },
  mounted() {
    this.subscription = this.vm.showAi.subscribe((isOpen) => {
      if (isOpen) this.refresh();
    });
  },
  beforeDestroy() {
    if (this.subscription) this.subscription.dispose();
    delete this.vm.aiPanel;
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    nameOf(id) {
      return LABELS[id].name;
    },
    refresh() {
      const context = this.editor.context();
      this.actions = availableActions({ kind: 'email' }, context).actions;
    },
    showList() {
      this.session = null;
      this.goOnAnyway = false;
      this.brief = '';
      this.refresh();
      this.vm.showAi(true);
    },
    openAction(id) {
      this.refresh();
      if (!this.actions.some((a) => a.id === id)) return;
      this.session = createActionSession({
        action: id,
        api,
        editor: this.editor,
      });
      this.goOnAnyway = false;
      this.brief = '';
      this.copiedIndex = null;
      this.vm.showAi(true);
      this.$nextTick(() => this.focus('heading'));
    },
    focus(ref) {
      const element = this.$refs[ref];
      if (element) element.focus();
    },
    generate() {
      this.copiedIndex = null;
      return this.session.request({ brief: this.brief });
    },
    more() {
      this.copiedIndex = null;
      return this.session.requestMore();
    },
    apply() {
      this.session.apply();
      this.refresh();
      this.$nextTick(() => this.focus('applied'));
    },
    undo() {
      this.session.undo();
      this.refresh();
    },
    async copy(index) {
      this.session.select(index);
      try {
        await navigator.clipboard.writeText(this.session.textToCopy());
        this.copiedIndex = index;
        this.copyError = false;
      } catch (err) {
        this.copyError = true;
      }
    },
    close() {
      this.vm.showAi(false);
    },
  },
  template,
});

module.exports = { AiPanel };
