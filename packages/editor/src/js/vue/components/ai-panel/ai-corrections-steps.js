'use strict';

const Vue = require('vue/dist/vue.common');
const template = require('./ai-corrections-steps.template');

// What a correction that is no longer pending says.
const STATUS_LABELS = {
  accepted: 'ai-panel-correction-accepted',
  ignored: 'ai-panel-correction-ignored',
  stale: 'ai-panel-correction-stale',
};

/**
 * The steps of a "corrections" action in the AI panel (ADR 0005): analyse the
 * target as soon as the action opens, then accept or ignore each correction.
 * The steps themselves live in the session (ext/ai-panel/sessions/
 * corrections.js); this renders them and keeps the focus and the announces.
 *
 * Emits `announce` (said to screen readers) and `changed` (the email changed).
 */
const AiCorrectionsSteps = Vue.component('AiCorrectionsSteps', {
  props: {
    vm: { type: Object, required: true },
    session: { type: Object, required: true },
    action: { type: Object, default: null },
    labelsOf: { type: Function, required: true },
  },
  data: () => ({ STATUS_LABELS }),
  computed: {
    state() {
      return this.session.state;
    },
    pending() {
      return this.state.corrections.filter((c) => c.status === 'pending');
    },
  },
  mounted() {
    this.analyse();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    focusSummary() {
      this.$nextTick(() => {
        if (this.$refs.summary) this.$refs.summary.focus();
      });
    },
    async analyse() {
      this.$emit('announce', this.t('ai-panel-correcting'));
      await this.session.request();
      if (this.state.error) return;
      this.$emit(
        'announce',
        this.state.corrections.length
          ? this.t('ai-panel-corrections-count', {
              count: this.state.corrections.length,
            })
          : this.t('ai-panel-no-correction')
      );
      this.focusSummary();
    },
    accept(correction) {
      this.session.accept(correction.id);
      this.$emit('announce', this.t(STATUS_LABELS[correction.status]));
      this.$emit('changed');
    },
    acceptAll() {
      const count = this.pending.length;
      this.session.acceptAll();
      this.$emit(
        'announce',
        this.t('ai-panel-corrections-accepted', { count })
      );
      this.$emit('changed');
      this.focusSummary();
    },
    ignore(correction) {
      this.session.ignore(correction.id);
      this.$emit('announce', this.t('ai-panel-correction-ignored'));
    },
  },
  template,
});

module.exports = { AiCorrectionsSteps };
