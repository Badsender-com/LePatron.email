const Vue = require('vue/dist/vue.common');
const _ = require('lodash');
const { QualityGroup } = require('./quality-group');
const { QualitySummary } = require('./quality-summary');
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
    // "All checks passed" only when every check was judged.
    allPassed() {
      return !this.hasIssues && !this.counts['not-run'];
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
      const parts = SEVERITY_ORDER.filter(
        (s) => s !== 'success' && this.counts[s] > 0
      ).map((s) =>
        this.t(SEVERITY_META[s].countKey, { count: this.counts[s] })
      );
      return parts.length ? parts.join(', ') : this.t('All checks passed');
    },
  },
  watch: {
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
      <div v-if="status === 'idle'" class="qc-drawer__empty">
        <span class="qc-drawer__empty-icon" aria-hidden="true"><span class="lucide lucide-shield-check"></span></span>
        <p class="qc-drawer__empty-title">{{ t('Run quality checks') }}</p>
        <p class="qc-drawer__empty-text">{{ t('Links, images and weight are checked before you send a test.') }}</p>
        <button type="button" class="qc-button qc-button--cta" @click="run">
          <span class="lucide lucide-play" aria-hidden="true"></span>
          {{ t('Run quality checks') }}
        </button>
        <p class="qc-drawer__hint">{{ t('__count__ checks', { count: vm.quality.ruleCount }) }}</p>
      </div>

      <div v-else-if="status === 'running'" class="qc-drawer__running">
        <span class="qc-running-label"><span class="qc-spinner" aria-hidden="true"></span>{{ t('Running checks…') }}</span>
        <button type="button" class="qc-button qc-button--outline qc-button--sm" @click="vm.quality.cancel()">{{ t('quality-action-cancel') }}</button>
      </div>

      <template v-else>
        <quality-summary
          :status="status"
          :counts="counts"
          :all-passed="allPassed"
          :checks-total="checks.length"
          :ran-at="ranAt"
          :remote-status="remoteStatus"
          :remote-error="remoteError"
          :t="t"
          @run="run"
        ></quality-summary>

        <div class="qc-drawer__list">
          <quality-group
            v-for="group in groups"
            :key="group.severity"
            :id="group.severity"
            :icon="group.meta.icon"
            :label-key="group.meta.groupKey"
            :count-key="group.meta.countKey"
            :items="group.items"
            :open="openGroups[group.severity]"
            :expanded-id="expandedId"
            :can-comment="canComment"
            :can-ignore="canIgnore"
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
            icon="lucide-ban"
            label-key="quality-group-ignored"
            count-key="__count__ ignored findings"
            :items="ignoredItems"
            :open="showIgnored"
            :expanded-id="expandedId"
            :can-comment="canComment"
            ignored
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

        <footer class="qc-drawer__footer">
          <button v-if="allPassed" type="button" class="qc-button qc-button--outline" @click="run">
            <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ t('Re-run') }}
          </button>
          <button type="button" class="qc-button qc-button--cta qc-button--grow" @click="$emit('send-test')">
            <span class="lucide lucide-send" aria-hidden="true"></span>{{ t('Send a test email') }}
          </button>
        </footer>
      </template>

      <p class="qc-sr-only" aria-live="polite" aria-atomic="false">{{ liveMessage }}</p>
    </div>
  `,
});

module.exports = { QualityChecksPanel, clearHighlight };
