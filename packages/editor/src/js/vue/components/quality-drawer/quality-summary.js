const Vue = require('vue/dist/vue.common');
const { SEVERITY_ORDER, SEVERITY_META } = require('./quality-meta');
const { formatTime } = require('./quality-items');

// The head of the results: whether they still describe the email, what they
// count by severity (or that every check passed), and how the server's checks
// went.
const QualitySummary = Vue.component('QualitySummary', {
  props: {
    // 'done' | 'stale' (the email changed since the run).
    status: { type: String, required: true },
    // Results by severity: { error: 2, warning: 0, … }.
    counts: { type: Object, required: true },
    // Every check passed: nothing to fix, nothing left unjudged.
    allPassed: { type: Boolean, default: false },
    checksTotal: { type: Number, default: 0 },
    ranAt: { type: Date, default: null },
    remoteStatus: { type: String, default: 'idle' },
    remoteError: { type: String, default: null },
    t: { type: Function, required: true },
  },
  computed: {
    // What is to deal with, never the passed ones; "not run" only when some.
    pills() {
      return SEVERITY_ORDER.filter(
        (s) => s !== 'success' && (s !== 'not-run' || this.counts[s] > 0)
      );
    },
    lastRunLabel() {
      return this.ranAt ? formatTime(this.ranAt) : '';
    },
    remoteErrorText() {
      return this.remoteError === 'too-frequent'
        ? this.t('Too many checks in a short time: try again in a few minutes')
        : this.t('The links and images could not be checked');
    },
  },
  created() {
    // A constant the template reads: not state.
    this.severityMeta = SEVERITY_META;
  },
  template: `
    <div class="qc-summary">
      <div v-if="status === 'stale'" class="qc-stale" role="status">
        <span class="lucide lucide-rotate-ccw" aria-hidden="true"></span>
        <span class="qc-stale__text">{{ t('The results date from before your last changes') }}</span>
        <button type="button" class="qc-button qc-button--outline qc-button--sm" @click="$emit('run')">
          <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ t('Re-run') }}
        </button>
      </div>

      <div v-if="!allPassed" class="qc-drawer__summary">
        <span class="qc-pills">
          <span
            v-for="severity in pills"
            :key="severity"
            class="qc-pill"
            :class="['qc-pill--' + severity, { 'qc-pill--empty': !counts[severity] }]"
          >
            <span :class="['lucide', severityMeta[severity].icon]" aria-hidden="true"></span>
            <span aria-hidden="true">{{ counts[severity] }}</span>
            <span class="qc-sr-only">{{ t(severityMeta[severity].countKey, { count: counts[severity] }) }}</span>
          </span>
        </span>
        <button type="button" class="qc-link-button" @click="$emit('run')">
          <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ t('Re-run') }}
        </button>
      </div>
      <div v-else-if="remoteStatus !== 'running'" class="qc-drawer__clean">
        <span class="qc-drawer__clean-icon" aria-hidden="true"><span class="lucide lucide-check"></span></span>
        <p class="qc-drawer__clean-title">{{ t('All checks passed') }}</p>
        <p class="qc-drawer__clean-text">
          {{ t('__passed__ of __total__ checks · __when__', { passed: counts.success, total: checksTotal, when: lastRunLabel }) }}
        </p>
      </div>

      <p v-if="remoteStatus === 'running'" class="qc-remote">
        <span class="qc-spinner" aria-hidden="true"></span>{{ t('Checking links and images…') }}
      </p>
      <p v-if="remoteStatus === 'error'" class="qc-remote qc-remote--error" role="status">
        <span class="lucide lucide-circle-help" aria-hidden="true"></span>{{ remoteErrorText }}
      </p>
    </div>
  `,
});

module.exports = { QualitySummary };
