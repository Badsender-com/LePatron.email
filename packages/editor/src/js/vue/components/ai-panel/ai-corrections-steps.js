'use strict';

const Vue = require('vue/dist/vue.common');
const template = require('./ai-corrections-steps.template');

// Which field a correction is in, on a block or the whole email.
const { ROLE_LABELS } = require('./field-role-labels');
const { pauseCountdown } = require('./pause-countdown');

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
 * The steps of a "corrections" action in the AI panel (ADR 0011): analyse the
 * target as soon as the action opens, then accept or ignore each correction.
 * The steps themselves live in the session (ext/ai-panel/sessions/
 * corrections.js); this renders them and keeps the focus and the announces.
 * Ctrl+Z (⌘Z) in the panel undoes in the editor, Ctrl+Shift+Z redoes.
 *
 * Emits `announce` (said to screen readers), `changed` (the email changed),
 * `footer` (its main buttons, [{ id, label, primary?, disabled? }], drawn in
 * the panel's foot, which calls `onFooter(id)`) and `back` (to the list).
 */
const AiCorrectionsSteps = Vue.component('AiCorrectionsSteps', {
  mixins: [pauseCountdown],
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
    // The list shown again from the summary (« Revoir les corrections »).
    reviewing: false,
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
    // Everything answered once the analysis is over (board a5): the summary.
    summary() {
      return (
        this.state.done &&
        this.state.corrections.length > 0 &&
        !this.open.length &&
        !this.reviewing
      );
    },
    // What became of the corrections, and what was not read.
    tally() {
      const count = (status) =>
        this.state.corrections.filter((c) => c.status === status).length;
      const leftOut = this.state.leftOut || {};
      const { progress } = this.state;
      // Blocks never analysed: the analysis was stopped, or they failed.
      const notAnalysed = progress ? progress.total - progress.done : 0;
      return {
        done: [
          ['ai-panel-tally-accepted', count('accepted')],
          ['ai-panel-tally-ignored', count('ignored')],
          ['ai-panel-tally-stale', count('stale')],
        ].filter(([, n]) => n > 0),
        unread: [
          ['ai-panel-tally-sample', leftOut.sample || 0],
          ['ai-panel-tally-too-long', this.state.tooLong || 0],
          ['ai-panel-tally-dropped', this.state.dropped || 0],
          ['ai-panel-tally-not-analysed', notAnalysed],
          ['ai-panel-tally-failed', this.state.failedBlocks.length],
        ].filter(([, n]) => n > 0),
      };
    },
    // Blocks the analysis read, those that failed left out.
    blocksRead() {
      const done = this.state.progress ? this.state.progress.done : 0;
      return Math.max(0, done - this.state.failedBlocks.length);
    },
    // « 8 blocs, 27 champs relus » on the whole email; the fields elsewhere.
    readSummary() {
      const fields = this.tCount('ai-panel-fields-read', this.state.fieldsRead || 0);
      if (!this.state.progress) return fields;
      return `${this.tCount('ai-panel-blocks-count', this.blocksRead)}, ${fields}`;
    },
    // The main buttons, in the panel's foot (boards a4, a5).
    footerButtons() {
      const acceptAll = this.open.length > 0 && {
        id: 'accept-all',
        label: this.t('ai-panel-accept-all-count', { count: this.open.length }),
        primary: true,
      };
      if (this.state.isLoading) {
        const stop = this.state.progress &&
          !this.state.stopped && {
            id: 'stop',
            label: this.t('ai-panel-correction-stop'),
          };
        return [stop, acceptAll].filter(Boolean);
      }
      if (acceptAll) return [acceptAll];
      const done = { id: 'done', label: this.t('ai-panel-done'), primary: true };
      if (this.summary) {
        return [{ id: 'review', label: this.t('ai-panel-review') }, done];
      }
      return [done];
    },
    failedLabels() {
      return this.state.failedBlocks
        .map((blockId) => this.session.blockLabel(blockId))
        .join(', ');
    },
  },
  watch: {
    footerButtons: {
      immediate: true,
      handler(buttons) {
        this.$emit('footer', buttons);
      },
    },
    // An undo reopens a correction: the summary gives way to the list, and
    // the focus goes to its head rather than to the page.
    summary(shown, wasShown) {
      if (wasShown && !shown && !this.reviewing) this.focusRef('summary');
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
    // A button of the panel's foot.
    onFooter(id) {
      if (id === 'stop') this.stop();
      else if (id === 'accept-all') this.acceptAll();
      else if (id === 'review') {
        this.reviewing = true;
        this.focusRef('summary');
      } else if (id === 'done') this.$emit('back');
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
