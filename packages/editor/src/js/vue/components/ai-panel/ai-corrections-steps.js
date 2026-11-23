'use strict';

const Vue = require('vue/dist/vue.common');
const template = require('./ai-corrections-steps.template');
const {
  ROLE_LABELS,
  STATUS_LABELS,
  isOpen,
  isAcceptable,
  isOpenRewrite,
  countKey,
  hasRun,
  emptyOutcomeOf,
  stoppedLabelOf,
  endMessageOf,
  groupsByBlock,
} = require('./ai-corrections-state');

const IS_MAC =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || '');

/**
 * The steps of a "corrections" action in the AI panel (ADR 0011): analyse the
 * target the first time the action opens, then accept or ignore each
 * correction. The panel draws these steps again each time it shows the
 * session: an analysis already made is shown as it was, never asked again;
 * « Relancer l'analyse » starts over, « Reprendre » goes on with an analysis
 * of the email stopped before its end. A rewrite (more than a few words
 * changed) is accepted only on its own, never by « Tout accepter ».
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
    // The countdown of a pause on the rate limit.
    now: Date.now(),
    pauseEnds: null,
    pauseTimer: null,
    // The end of the analysis this component started was already said.
    endHandled: true,
  }),
  computed: {
    state() {
      return this.session.state;
    },
    isEmail() {
      return this.state.target.kind === 'email';
    },
    acceptable() {
      return this.state.corrections.filter(isAcceptable);
    },
    openRewrites() {
      return this.state.corrections.filter(isOpenRewrite);
    },
    // The undo hint once there is something to undo.
    hasAccepted() {
      return this.state.corrections.some(
        (c) => c.status === 'accepted' || c.status === 'undone'
      );
    },
    // The corrections by block on the whole email; one group otherwise.
    groups() {
      const { corrections } = this.state;
      if (!this.isEmail) return [{ blockId: null, label: null, corrections }];
      return groupsByBlock(corrections, this.session.blockLabel);
    },
    failedLabels() {
      return this.state.failedBlocks
        .map((blockId) => this.session.blockLabel(blockId))
        .join(', ');
    },
    countLabel() {
      return this.tCount(
        'ai-panel-corrections-count',
        this.state.corrections.length
      );
    },
    stoppedLabel() {
      return stoppedLabelOf(this.state, this.t);
    },
    // What an analysis that found nothing says, or null.
    emptyOutcome() {
      return emptyOutcomeOf(this.state);
    },
    pauseSeconds() {
      if (!this.pauseEnds) return this.state.pausedFor;
      return Math.max(0, Math.ceil((this.pauseEnds - this.now) / 1000));
    },
    canRestart() {
      return (
        !this.state.isLoading &&
        Boolean(this.state.done || this.state.error) &&
        typeof this.session.restart === 'function'
      );
    },
    canResume() {
      return (
        !this.state.isLoading &&
        Boolean(this.state.canResume) &&
        typeof this.session.resume === 'function'
      );
    },
  },
  watch: {
    'state.pausedFor'(seconds) {
      this.followPause();
      if (seconds) {
        this.$emit(
          'announce',
          this.t('ai-panel-correction-paused', { seconds })
        );
      }
    },
    'state.resumesAt'() {
      this.followPause();
    },
    // Run before the steps are drawn again: the focus is still where it was.
    'state.isLoading'(loading, was) {
      if (!loading && was) this.finished();
    },
  },
  mounted() {
    this.followPause();
    // Shown again: the analysis made stays as it was.
    if (!hasRun(this.state)) this.run(() => this.session.request());
  },
  beforeDestroy() {
    clearInterval(this.pauseTimer);
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    tCount(key, count) {
      return this.t(countKey(key, count), { count });
    },
    isOpen,
    focusRef(...names) {
      this.$nextTick(() => {
        const found = names
          .map((name) => this.$refs[name])
          .map((ref) => (Array.isArray(ref) ? ref[0] : ref))
          .find(Boolean);
        if (found) found.focus();
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
    // The focus is on what disappears at the end: « Arrêter », the progress,
    // or nowhere since the button it was on went away.
    focusOnProgress() {
      const active = document.activeElement;
      const { status } = this.$refs;
      if (!active || active === document.body) return true;
      return Boolean(status && status.contains(active));
    },
    async run(start) {
      this.endHandled = false;
      this.$emit('announce', this.t('ai-panel-correcting'));
      await start();
      // Ended within one tick, unseen by the watcher.
      if (!this.endHandled) this.finished();
    },
    restart() {
      this.run(() => this.session.restart());
      this.focusRef('stop', 'status');
    },
    resume() {
      this.run(() => this.session.resume());
      this.focusRef('stop', 'status');
    },
    // Said through the panel's live region. On the whole email, the user went
    // on working meanwhile: the focus moves only if it was on what is gone.
    finished() {
      this.endHandled = true;
      const moveFocus = !this.isEmail || this.focusOnProgress();
      if (!this.state.error) {
        this.$emit('announce', endMessageOf(this.state, this.t));
      }
      if (moveFocus) this.focusRef('summary', 'resume', 'restart');
    },
    // A countdown to the end of the pause, from the hour the session gives,
    // or from its delay.
    followPause() {
      const { pausedFor, resumesAt } = this.state;
      clearInterval(this.pauseTimer);
      this.pauseTimer = null;
      if (!pausedFor) {
        this.pauseEnds = null;
        return;
      }
      this.now = Date.now();
      this.pauseEnds = resumesAt
        ? new Date(resumesAt).getTime()
        : this.now + pausedFor * 1000;
      this.pauseTimer = setInterval(() => {
        this.now = Date.now();
      }, 1000);
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
    // The session accepts every open correction as one step of the undo; with
    // a rewrite among them, the others are accepted one by one.
    acceptAmong(corrections, acceptAllOfSession) {
      if (!corrections.some(isOpenRewrite)) return acceptAllOfSession();
      return corrections.filter(isAcceptable).reduce(
        (sum, c) => {
          const { accepted, stale } = this.session.accept(c.id);
          return {
            accepted: sum.accepted + accepted,
            stale: sum.stale + stale,
          };
        },
        { accepted: 0, stale: 0 }
      );
    },
    sayAccepted({ accepted, stale }, among) {
      const said = [this.tCount('ai-panel-corrections-accepted', accepted)];
      if (stale) said.push(this.tCount('ai-panel-corrections-stale', stale));
      const rewrites = among.filter(isOpenRewrite).length;
      if (rewrites) said.push(this.tCount('ai-panel-rewrites-left', rewrites));
      this.$emit('announce', said.join(' '));
      if (accepted) this.$emit('changed');
    },
    acceptAll() {
      const all = this.state.corrections;
      this.sayAccepted(
        this.acceptAmong(all, () => this.session.acceptAll()),
        all
      );
      this.focusRef('summary');
    },
    acceptBlock(group) {
      const { blockId, corrections } = group;
      this.sayAccepted(
        this.acceptAmong(corrections, () => this.session.acceptBlock(blockId)),
        corrections
      );
      this.focusNext(corrections[corrections.length - 1]);
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
