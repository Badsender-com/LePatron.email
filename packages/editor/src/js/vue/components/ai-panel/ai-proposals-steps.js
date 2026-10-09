'use strict';

const Vue = require('vue/dist/vue.common');
const template = require('./ai-proposals-steps.template');

/**
 * The steps of a "proposals" action in the AI panel (text generation, ADR
 * 0004): the instruction, the proposals, pick, apply or copy, undo. The steps
 * themselves live in the session (ext/ai-panel/sessions/proposals.js); this
 * renders them and keeps the focus where the user goes on.
 *
 * Emits `open-action` (the suggested or next action), `announce` (said to
 * screen readers) and `changed` (the email changed: the panel re-reads it).
 */
const AiProposalsSteps = Vue.component('AiProposalsSteps', {
  props: {
    vm: { type: Object, required: true },
    session: { type: Object, required: true },
    // What the action offers now: canApply, suggestFirst.
    action: { type: Object, default: null },
    labelsOf: { type: Function, required: true },
  },
  data: () => ({
    // The user chose to go on without what the action suggests first.
    goOnAnyway: false,
    brief: '',
    copyError: false,
    undoRefused: false,
  }),
  computed: {
    state() {
      return this.session.state;
    },
    labels() {
      return this.labelsOf(this.state.action);
    },
    // The strong suggestion to run another action first.
    urgesFirst() {
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
      return this.state.proposals[this.state.selectedIndex];
    },
    appliedText() {
      const { applied } = this.state;
      return applied ? Object.values(applied)[0] : '';
    },
    nextAction() {
      return this.session.nextAction();
    },
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    // After a step replaced what had the focus: put it where the user goes on.
    focusAfterRender(ref) {
      this.$nextTick(() => {
        const element = this.$refs[ref];
        const target = Array.isArray(element) ? element[0] : element;
        if (target) target.focus();
      });
    },
    goOn() {
      this.goOnAnyway = true;
      this.focusAfterRender('brief');
    },
    async ask(request) {
      this.copyError = false;
      this.undoRefused = false;
      this.$emit('announce', this.t('ai-panel-loading'));
      await request;
      if (this.state.error || !this.state.proposals.length) return;
      this.$emit(
        'announce',
        this.t('ai-panel-proposed', { count: this.state.proposals.length })
      );
      this.focusAfterRender('proposals');
    },
    generate() {
      return this.ask(this.session.request({ brief: this.brief }));
    },
    more() {
      return this.ask(this.session.requestMore({ brief: this.brief }));
    },
    apply() {
      this.session.apply();
      this.$emit('changed');
      this.focusAfterRender('applied');
    },
    undo() {
      this.undoRefused = !this.session.undo();
      this.$emit('changed');
      if (this.undoRefused) return;
      this.$emit('announce', this.t('ai-panel-undone'));
      this.focusAfterRender('picked');
    },
    async copy(index) {
      try {
        await navigator.clipboard.writeText(this.state.proposals[index].text);
        this.session.copied(index);
        this.copyError = false;
        this.$emit('announce', this.t('text-generation-copied'));
        this.$emit('changed');
      } catch (err) {
        this.copyError = true;
      }
    },
  },
  template,
});

module.exports = { AiProposalsSteps };
