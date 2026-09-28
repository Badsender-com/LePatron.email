const Vue = require('vue/dist/vue.common');
const { QualityIssueRow } = require('./quality-issue-row');
const {
  SEVERITY_ORDER,
  SEVERITY_META,
  CATEGORY_KEYS,
} = require('./quality-meta');
const { goToBlock } = require('../../../ext/block-navigation');
const { formatCommentDate } = require('../../../ext/comments-utils');

const HIGHLIGHT_CLASS = 'qc-highlight';

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
// results by severity and takes the user to the block of each one.
const QualityChecksPanel = Vue.component('QualityChecksPanel', {
  components: { QualityIssueRow },
  props: {
    vm: { type: Object, required: true },
    status: { type: String, default: 'idle' },
    findings: { type: Array, default: () => [] },
    checks: { type: Array, default: () => [] },
    ranAt: { type: Date, default: null },
  },
  data: () => ({
    expandedId: null,
    // Constants the template reads.
    severityOrder: SEVERITY_ORDER,
    severityMeta: SEVERITY_META,
  }),
  computed: {
    items() {
      const seen = {};
      const findingItems = this.findings.map((f) => {
        seen[f.fingerprint] = (seen[f.fingerprint] || 0) + 1;
        return {
          id: `${f.fingerprint}#${seen[f.fingerprint]}`,
          severity: f.severity,
          title: this.t(f.titleKey),
          description: this.t(f.messageKey, f.params),
          category: this.t(CATEGORY_KEYS[f.category]),
          blockId: f.blockId,
          blockLabel: f.blockLabel,
        };
      });
      const checkItems = this.checks
        .filter((c) => c.status !== 'failed')
        .map((c) => ({
          id: `check:${c.ruleId}`,
          // A check that could not run is shown, never counted as passed.
          severity: c.status === 'passed' ? 'success' : 'info',
          title: this.t(c.titleKey),
          description:
            c.status === 'passed'
              ? this.t(c.passKey, c.passParams)
              : this.t('This check could not run'),
          category: this.t(CATEGORY_KEYS[c.category]),
          blockId: null,
          blockLabel: null,
        }));
      return findingItems.concat(checkItems);
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
    lastRunLabel() {
      return this.ranAt ? formatCommentDate(this.ranAt.toISOString(), this.t) : '';
    },
    liveMessage() {
      if (this.status === 'running') return this.t('Running checks…');
      if (this.status !== 'done') return '';
      return SEVERITY_ORDER.map((s) =>
        this.t(SEVERITY_META[s].countKey, { count: this.counts[s] })
      ).join(', ');
    },
  },
  watch: {
    items(items) {
      if (!items.some((item) => item.id === this.expandedId)) {
        this.expandedId = null;
      }
    },
  },
  beforeDestroy() {
    clearHighlight();
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    run() {
      clearHighlight();
      this.vm.quality.run();
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
        <div v-else class="qc-drawer__clean">
          <span class="qc-drawer__clean-icon" aria-hidden="true"><span class="lucide lucide-check"></span></span>
          <p class="qc-drawer__clean-title">{{ t('All checks passed') }}</p>
          <p class="qc-drawer__clean-text">
            {{ t('__passed__ of __total__ checks · __when__', { passed: counts.success, total: checks.length, when: lastRunLabel }) }}
          </p>
        </div>

        <div class="qc-drawer__list">
          <div v-for="group in groups" :key="group.severity" class="qc-group">
            <h3 class="qc-group__header">
              <span :class="['lucide', group.meta.icon, 'qc-sev--' + group.severity]" aria-hidden="true"></span>
              <span class="qc-group__label">{{ t(group.meta.groupKey) }}</span>
              <span class="qc-group__count">{{ group.items.length }}</span>
            </h3>
            <quality-issue-row
              v-for="item in group.items"
              :key="item.id"
              :item="item"
              :t="t"
              :expanded="expandedId === item.id"
              @toggle="toggle(item)"
              @locate="locate(item)"
            ></quality-issue-row>
          </div>
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
