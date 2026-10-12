'use strict';

const Vue = require('vue/dist/vue.common');
const template = require('./ai-corrections-steps.template');

// Which field a correction is in, on a block or the whole email.
const ROLE_LABELS = {
  title: 'ai-panel-field-title',
  text: 'ai-panel-field-text',
  button: 'ai-panel-field-button',
  alt: 'ai-panel-field-alt',
};

// What a correction that is no longer pending says.
const STATUS_LABELS = {
  accepted: 'ai-panel-correction-accepted',
  undone: 'ai-panel-correction-undone',
  ignored: 'ai-panel-correction-ignored',
  stale: 'ai-panel-correction-stale',
};

// A correction the user can still accept: never answered, or taken back.
const isOpen = (correction) =>
  correction.status === 'pending' || correction.status === 'undone';

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || '');

// A count said with its own key for one: « 1 correction », « 3 corrections ».
const countKey = (key, count) => (count === 1 ? `${key}-one` : key);

/**
 * The steps of a "corrections" action in the AI panel (ADR 0005): analyse the
 * target as soon as the action opens, then accept or ignore each correction.
 * The steps themselves live in the session (ext/ai-panel/sessions/
 * corrections.js); this renders them and keeps the focus and the announces.
 * Ctrl+Z (⌘Z) in the panel undoes in the editor, Ctrl+Shift+Z redoes.
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
  data: () => ({
    STATUS_LABELS,
    ROLE_LABELS,
    undoKeys: IS_MAC ? '⌘Z' : 'Ctrl+Z',
  }),
  computed: {
    state() {
      return this.session.state;
    },
    open() {
      return this.state.corrections.filter(isOpen);
    },
    // The undo hint once there is something to undo.
    hasAccepted() {
      return this.state.corrections.some(
        (c) => c.status === 'accepted' || c.status === 'undone'
      );
    },
    // The corrections by block on the whole email; one group otherwise.
    groups() {
      if (this.state.target.kind !== 'email') {
        return [{ blockId: null, label: null, corrections: this.state.corrections }];
      }
      const groups = [];
      this.state.corrections.forEach((correction) => {
        let group = groups.find((g) => g.blockId === correction.blockId);
        if (!group) {
          group = {
            blockId: correction.blockId,
            label: this.session.blockLabel(correction.blockId),
            corrections: [],
          };
          groups.push(group);
        }
        group.corrections.push(correction);
      });
      return groups.map((group) => ({
        ...group,
        open: group.corrections.filter(isOpen).length,
      }));
    },
    failedLabels() {
      return this.state.failedBlocks
        .map((blockId) => this.session.blockLabel(blockId))
        .join(', ');
    },
  },
  watch: {
    'state.pausedFor'(seconds) {
      if (seconds) {
        this.$emit('announce', this.t('ai-panel-correction-paused', { seconds }));
      }
    },
  },
  mounted() {
    this.analyse();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    tCount(key, count) {
      return this.t(countKey(key, count), { count });
    },
    isOpen,
    focusRef(name) {
      this.$nextTick(() => {
        const ref = this.$refs[name];
        const element = Array.isArray(ref) ? ref[0] : ref;
        if (element) element.focus();
      });
    },
    // After answering a correction: the next one still open, or the summary.
    focusNext(after) {
      const list = this.state.corrections;
      const from = list.indexOf(after);
      const next =
        list.slice(from + 1).find(isOpen) || list.slice(0, from).find(isOpen);
      this.focusRef(next ? `accept-${next.id}` : 'summary');
    },
    async analyse() {
      this.$emit('announce', this.t('ai-panel-correcting'));
      await this.session.request();
      if (this.state.error) return;
      const count = this.state.corrections.length;
      let said;
      if (this.state.stopped) {
        const { done, total } = this.state.progress;
        said = this.t(countKey('ai-panel-correction-stopped', done), {
          done,
          total,
        });
      } else if (this.state.target.kind === 'email') {
        said = count
          ? this.tCount('ai-panel-correction-finished', count)
          : this.t('ai-panel-no-correction');
      } else {
        said = count
          ? this.tCount('ai-panel-corrections-count', count)
          : this.t('ai-panel-no-correction');
      }
      this.$emit('announce', said);
      this.focusRef('summary');
    },
    stop() {
      this.session.stop();
    },
    accept(correction) {
      const { accepted } = this.session.accept(correction.id);
      this.$emit('announce', this.t(STATUS_LABELS[correction.status]));
      if (accepted) this.$emit('changed');
      this.focusNext(correction);
    },
    acceptAll() {
      const { accepted, stale } = this.session.acceptAll();
      const said = [this.tCount('ai-panel-corrections-accepted', accepted)];
      if (stale) said.push(this.tCount('ai-panel-corrections-stale', stale));
      this.$emit('announce', said.join(' '));
      if (accepted) this.$emit('changed');
      this.focusRef('summary');
    },
    acceptBlock(group) {
      const { accepted, stale } = this.session.acceptBlock(group.blockId);
      const said = [this.tCount('ai-panel-corrections-accepted', accepted)];
      if (stale) said.push(this.tCount('ai-panel-corrections-stale', stale));
      this.$emit('announce', said.join(' '));
      if (accepted) this.$emit('changed');
      this.focusNext(group.corrections[group.corrections.length - 1]);
    },
    goToBlock(blockId) {
      this.session.goToBlock(blockId);
    },
    ignore(correction) {
      this.session.ignore(correction.id);
      this.$emit('announce', this.t('ai-panel-correction-ignored'));
      this.focusNext(correction);
    },
    // The editor's undo from the panel, where the focus is after accepting.
    onKeydown(event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
      const key = event.key.toLowerCase();
      const redo = (key === 'z' && event.shiftKey) || key === 'y';
      if (key !== 'z' && !redo) return;
      const field = event.target.closest('input, textarea, [contenteditable]');
      if (field) return;
      event.preventDefault();
      if (redo) this.session.redo();
      else this.session.undo();
    },
  },
  template,
});

module.exports = { AiCorrectionsSteps };
