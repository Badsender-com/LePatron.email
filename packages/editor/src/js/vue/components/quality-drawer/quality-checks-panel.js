const Vue = require('vue/dist/vue.common');
const { QualityIssueRow } = require('./quality-issue-row');
const { SEVERITY_ORDER, SEVERITY_META } = require('./quality-meta');
const { findingItems, checkItems } = require('./quality-items');
const { commentDraftFor } = require('./quality-actions');
const { goToBlock } = require('../../../ext/block-navigation');
const { formatCommentDate } = require('../../../ext/comments-utils');

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
  components: { QualityIssueRow },
  props: {
    vm: { type: Object, required: true },
    status: { type: String, default: 'idle' },
    // The server's checks (links, image weight), which come after the others.
    remoteStatus: { type: String, default: 'idle' },
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
    undoTimer: null,
    // Constants the template reads.
    severityOrder: SEVERITY_ORDER,
    severityMeta: SEVERITY_META,
  }),
  computed: {
    items() {
      return findingItems(this.findings, this.t).concat(checkItems(this.checks, this.t));
    },
    ignoredItems() {
      return findingItems(this.ignoredFindings, this.t);
    },
    groups() {
      return SEVERITY_ORDER.map((severity) => ({
        severity,
        meta: SEVERITY_META[severity],
        items: this.items.filter((item) => item.severity === severity),
      })).filter((group) => group.items.length);
    },
    counts() {
      return SEVERITY_ORDER.reduce((acc, severity) => {
        acc[severity] = this.items.filter((i) => i.severity === severity).length;
        return acc;
      }, {});
    },
    hasIssues() {
      return this.findings.length > 0;
    },
    canComment() {
      return typeof this.vm.createCommentFromQc === 'function';
    },
    lastRunLabel() {
      return this.ranAt ? formatCommentDate(this.ranAt.toISOString(), this.t) : '';
    },
    liveMessage() {
      if (this.status === 'running') return this.t('Running checks…');
      if (this.remoteStatus === 'running') {
        return this.t('Checking links and images…');
      }
      if (this.status !== 'done') return '';
      return SEVERITY_ORDER.map((s) =>
        this.t(SEVERITY_META[s].countKey, { count: this.counts[s] })
      ).join(', ');
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
      const found = goToBlock(this.vm, item.blockId, (element) =>
        element.classList.add(HIGHLIGHT_CLASS, `${HIGHLIGHT_CLASS}--${item.severity}`)
      );
      if (!found) this.vm.notifier.warning(this.t('comments-block-deleted'));
    },
    comment(item) {
      this.vm.createCommentFromQc(commentDraftFor(item, this.t));
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
    },
    undoIgnore() {
      clearTimeout(this.undoTimer);
      this.unignore(this.undo);
      this.undo = null;
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
        <button type="button" class="qc-button qc-button--outline qc-button--sm" @click="vm.quality.cancel()">{{ t('Cancel') }}</button>
      </div>

      <template v-else>
        <div v-if="hasIssues" class="qc-drawer__summary">
          <span class="qc-pills">
            <span
              v-for="severity in severityOrder"
              :key="severity"
              class="qc-pill"
              :class="['qc-pill--' + severity, { 'qc-pill--empty': !counts[severity] }]"
            >
              <span :class="['lucide', severityMeta[severity].icon]" aria-hidden="true"></span>
              <span aria-hidden="true">{{ counts[severity] }}</span>
              <span class="qc-sr-only">{{ t(severityMeta[severity].countKey, { count: counts[severity] }) }}</span>
            </span>
          </span>
          <button type="button" class="qc-link-button" @click="run">
            <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ t('Re-run') }}
          </button>
        </div>
        <div v-else-if="remoteStatus !== 'running'" class="qc-drawer__clean">
          <span class="qc-drawer__clean-icon" aria-hidden="true"><span class="lucide lucide-check"></span></span>
          <p class="qc-drawer__clean-title">{{ t('All checks passed') }}</p>
          <p class="qc-drawer__clean-text">
            {{ t('__passed__ of __total__ checks · __when__', { passed: counts.success, total: checks.length, when: lastRunLabel }) }}
          </p>
        </div>

        <p v-if="remoteStatus === 'running'" class="qc-remote">
          <span class="qc-spinner" aria-hidden="true"></span>{{ t('Checking links and images…') }}
        </p>

        <div class="qc-drawer__list">
          <div v-for="group in groups" :key="group.severity" class="qc-group">
            <h3 class="qc-group__header">
              <button type="button" class="qc-group__toggle" :aria-expanded="openGroups[group.severity] ? 'true' : 'false'" @click="toggleGroup(group.severity)">
                <span :class="['lucide', group.meta.icon, 'qc-sev--' + group.severity]" aria-hidden="true"></span>
                <span class="qc-group__label">{{ t(group.meta.groupKey) }}</span>
                <span class="qc-group__count">{{ group.items.length }}</span>
                <span :class="['lucide', openGroups[group.severity] ? 'lucide-chevron-up' : 'lucide-chevron-down']" aria-hidden="true"></span>
              </button>
            </h3>
            <template v-if="openGroups[group.severity]">
              <quality-issue-row
                v-for="item in group.items"
                :key="item.id"
                :item="item"
                :t="t"
                :can-comment="canComment"
                :expanded="expandedId === item.id"
                @toggle="toggle(item)"
                @locate="locate(item)"
                @comment="comment(item)"
                @ignore="ignore(item)"
              ></quality-issue-row>
            </template>
          </div>

          <div v-if="ignoredItems.length" class="qc-group qc-group--ignored">
            <h3 class="qc-group__header">
              <button type="button" class="qc-group__toggle" :aria-expanded="showIgnored ? 'true' : 'false'" @click="showIgnored = !showIgnored">
                <span class="lucide lucide-ban" aria-hidden="true"></span>
                <span class="qc-group__label">{{ t('Ignored') }}</span>
                <span class="qc-group__count">{{ ignoredItems.length }}</span>
                <span :class="['lucide', showIgnored ? 'lucide-chevron-up' : 'lucide-chevron-down']" aria-hidden="true"></span>
              </button>
            </h3>
            <template v-if="showIgnored">
              <quality-issue-row
                v-for="item in ignoredItems"
                :key="item.id"
                :item="item"
                :t="t"
                ignored
                :can-comment="canComment"
                :expanded="expandedId === item.id"
                @toggle="toggle(item)"
                @locate="locate(item)"
                @comment="comment(item)"
                @unignore="unignore(item)"
              ></quality-issue-row>
            </template>
          </div>
        </div>

        <div v-if="undo" class="qc-undo" role="status">
          <span>{{ t('Ignored: __title__', { title: undo.title }) }}</span>
          <button type="button" class="qc-link-button" @click="undoIgnore">{{ t('Undo') }}</button>
        </div>

        <footer class="qc-drawer__footer">
          <button v-if="!hasIssues" type="button" class="qc-button qc-button--outline" @click="run">
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
