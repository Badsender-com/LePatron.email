const Vue = require('vue/dist/vue.common');
const _ = require('lodash');
const { QualityGroup } = require('./quality-group');
const { QualitySummary } = require('./quality-summary');
const { verdictOf } = require('./quality-verdict');
const { SEVERITY_ORDER, SEVERITY_META } = require('./quality-meta');
const { findingItems, checkItems } = require('./quality-items');
const { commentDraftFor } = require('./quality-actions');
const { goToBlock, findBlockById } = require('../../../ext/block-navigation');

const HIGHLIGHT_CLASS = 'qc-highlight';
// How long "Ignored. Undo" stays under the list.
const UNDO_DELAY_MS = 8000;

function clearHighlight() {
  document
    .querySelectorAll(`.${HIGHLIGHT_CLASS}`)
    .forEach((el) =>
      el.classList.remove(
        HIGHLIGHT_CLASS,
        ...SEVERITY_ORDER.map((s) => `${HIGHLIGHT_CLASS}--${s}`)
      )
    );
}

// The "Checks" tab of the quality drawer: runs the checks, lists their
// results by severity and acts on each one: go to its block, turn it into a
// comment, or ignore it (the ignored ones wait in their own group).
const QualityChecksPanel = Vue.component('QualityChecksPanel', {
  components: { QualityGroup, QualitySummary },
  props: {
    vm: { type: Object, required: true },
    // 'idle' | 'running' | 'done' | 'stale' (the email changed since).
    status: { type: String, default: 'idle' },
    // The server's checks (links, image weight), which come after the others.
    remoteStatus: { type: String, default: 'idle' },
    remoteError: { type: String, default: null },
    // The findings still to deal with, and those the team ignored.
    findings: { type: Array, default: () => [] },
    ignoredFindings: { type: Array, default: () => [] },
    checks: { type: Array, default: () => [] },
    ranAt: { type: Date, default: null },
    // The ready rule (ADR 0020), the rail badge's: nothing to fix, every check
    // judged; infos may be left.
    ready: { type: Boolean, default: false },
    // What is left to fix, and what of it blocks the export.
    issueCount: { type: Number, default: 0 },
    blockingCount: { type: Number, default: 0 },
    // The user's role may not ignore (quality-drawer.js).
    ignoreLocked: { type: Boolean, default: false },
  },
  data: () => ({
    expandedId: null,
    // Which groups are unfolded, by severity. Kept across re-runs.
    openGroups: SEVERITY_ORDER.reduce((acc, severity) => {
      acc[severity] = !SEVERITY_META[severity].collapsed;
      return acc;
    }, {}),
    showIgnored: false,
    undo: null,
  }),
  computed: {
    items() {
      return findingItems(this.findings, this.t).concat(
        checkItems(this.checks, this.t)
      );
    },
    ignoredItems() {
      return findingItems(this.ignoredFindings, this.t);
    },
    bySeverity() {
      return _.groupBy(this.items, 'severity');
    },
    groups() {
      return SEVERITY_ORDER.map((severity) => ({
        severity,
        meta: SEVERITY_META[severity],
        items: this.bySeverity[severity] || [],
      })).filter((group) => group.items.length);
    },
    counts() {
      return _.mapValues(
        SEVERITY_META,
        (_meta, severity) => (this.bySeverity[severity] || []).length
      );
    },
    hasIssues() {
      return this.findings.length > 0;
    },
    hasResults() {
      return this.status === 'done' || this.status === 'stale';
    },
    canComment() {
      return typeof this.vm.createCommentFromQc === 'function';
    },
    canIgnore() {
      return Boolean(this.vm.quality.canIgnore);
    },
    liveMessage() {
      if (this.status === 'running') return this.t('Running checks…');
      if (this.remoteStatus === 'running') {
        return this.t('Checking links and images…');
      }
      if (!this.hasResults) return '';
      if (this.status === 'stale') {
        return this.t('The results date from before your last changes');
      }
      // Said as the card says it (quality-verdict.js).
      const verdict = verdictOf(
        {
          ready: this.ready,
          issueCount: this.issueCount,
          blockingCount: this.blockingCount,
        },
        this.t
      );
      const infos =
        verdict.kind === 'ready' && this.counts.info
          ? this.t('quality-ready-infos', { count: this.counts.info })
          : '';
      return [verdict.title, infos].filter(Boolean).join('. ');
    },
  },
  watch: {
    // A ready email leaves only its infos to read (board q3): they show.
    ready(isReady) {
      if (isReady) this.openGroups.info = true;
    },
    items(items) {
      const all = items.concat(this.ignoredItems);
      if (!all.some((item) => item.id === this.expandedId)) {
        this.expandedId = null;
      }
    },
  },
  created() {
    // A timer: not state.
    this.undoTimer = null;
  },
  beforeDestroy() {
    clearHighlight();
    clearTimeout(this.undoTimer);
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    run() {
      clearHighlight();
      this.vm.quality.run();
    },
    toggleGroup(severity) {
      this.openGroups[severity] = !this.openGroups[severity];
    },
    toggle(item) {
      this.expandedId = this.expandedId === item.id ? null : item.id;
    },
    locate(item) {
      clearHighlight();
      const found = goToBlock(
        this.vm,
        item.blockId,
        (element) =>
          element.classList.add(
            HIGHLIGHT_CLASS,
            `${HIGHLIGHT_CLASS}--${item.severity}`
          ),
        () => this.vm.notifier.warning(this.t('The block could not be shown'))
      );
      if (!found) this.vm.notifier.warning(this.t('comments-block-deleted'));
    },
    comment(item) {
      const draft = commentDraftFor(item, this.t);
      // A block deleted since the run: the comment is about the whole email.
      if (draft.blockId && !findBlockById(this.vm, draft.blockId)) {
        this.vm.notifier.warning(this.t('comments-block-deleted'));
        draft.blockId = null;
      }
      this.vm.createCommentFromQc(draft);
    },
    ignore(item) {
      this.vm.quality.ignore(item.finding);
      clearTimeout(this.undoTimer);
      this.undo = item;
      this.undoTimer = setTimeout(() => {
        this.undo = null;
      }, UNDO_DELAY_MS);
    },
    unignore(item) {
      this.vm.quality.unignore(item.finding);
      // Nothing left to undo once released by hand.
      if (this.undo && this.undo.id === item.id) {
        clearTimeout(this.undoTimer);
        this.undo = null;
      }
    },
    undoIgnore() {
      this.unignore(this.undo);
    },
  },
  template: `
    <div class="qc-panel">
      <!-- Before a run (board q1): what will be checked; « Lancer le
           contrôle » is the panel's foot. -->
      <div v-if="status === 'idle'" class="qc-drawer__empty">
        <span class="lucide lucide-shield-check qc-drawer__empty-icon" aria-hidden="true"></span>
        <p class="qc-drawer__empty-title">{{ t('quality-ready-to-run', { count: vm.quality.ruleCount }) }}</p>
        <p class="qc-drawer__empty-text">{{ t('quality-ready-to-run-text') }}</p>
        <p v-if="vm.quality.turnedOffCount() > 0" class="qc-drawer__empty-text qc-turned-off">{{ t('__count__ checks turned off by your group or template', { count: vm.quality.turnedOffCount() }) }}</p>
      </div>

      <div v-else-if="status === 'running'" class="qc-drawer__running">
        <span class="qc-running-label"><span class="qc-spinner" aria-hidden="true"></span>{{ t('Running checks…') }}</span>
      </div>

      <template v-else>
        <quality-summary
          :status="status"
          :counts="counts"
          :ready="ready"
          :issue-count="issueCount"
          :blocking-count="blockingCount"
          :checks-total="checks.length"
          :ran-at="ranAt"
          :remote-status="remoteStatus"
          :remote-error="remoteError"
          :t="t"
        ></quality-summary>
        <p v-if="vm.quality.turnedOffCount() > 0" class="qc-drawer__hint qc-turned-off">{{ t('__count__ checks turned off by your group or template', { count: vm.quality.turnedOffCount() }) }}</p>

        <div class="qc-drawer__list">
          <quality-group
            v-for="group in groups"
            :key="group.severity"
            :id="group.severity"
            :label-key="group.meta.groupKey"
            :count-key="group.meta.countKey"
            :items="group.items"
            :open="openGroups[group.severity]"
            :expanded-id="expandedId"
            :can-comment="canComment"
            :can-ignore="canIgnore"
            :ignore-locked="ignoreLocked"
            :t="t"
            @toggle-open="toggleGroup(group.severity)"
            @toggle="toggle"
            @locate="locate"
            @comment="comment"
            @ignore="ignore"
          ></quality-group>

          <quality-group
            v-if="ignoredItems.length"
            id="ignored"
            label-key="quality-group-ignored"
            count-key="__count__ ignored findings"
            :items="ignoredItems"
            :open="showIgnored"
            :expanded-id="expandedId"
            :can-comment="canComment"
            ignored
            :ignore-locked="ignoreLocked"
            :t="t"
            @toggle-open="showIgnored = !showIgnored"
            @toggle="toggle"
            @locate="locate"
            @comment="comment"
            @unignore="unignore"
          ></quality-group>
        </div>

        <div v-if="undo" class="qc-undo" role="status">
          <span>{{ t('Ignored: __title__', { title: undo.title }) }}</span>
          <button type="button" class="qc-link-button" @click="undoIgnore">{{ t('quality-action-undo') }}</button>
        </div>

      </template>

      <p class="qc-sr-only" aria-live="polite" aria-atomic="false">{{ liveMessage }}</p>
    </div>
  `,
});

module.exports = { QualityChecksPanel, clearHighlight };
