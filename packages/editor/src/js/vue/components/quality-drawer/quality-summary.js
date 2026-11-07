const Vue = require('vue/dist/vue.common');
const { formatTime } = require('./quality-items');
const { verdictOf } = require('./quality-verdict');

// The head of the results: whether they still describe the email, where the
// email stands (ready, or what is left to fix), and how the server's checks
// went.
const QualitySummary = Vue.component('QualitySummary', {
  props: {
    // 'done' | 'stale' (the email changed since the run).
    status: { type: String, required: true },
    // Results by severity: { error: 2, warning: 0, … }.
    counts: { type: Object, required: true },
    // The ready rule (ADR 0020): nothing to fix, nothing left unjudged; infos
    // may be left, to read if one wishes.
    ready: { type: Boolean, default: false },
    // What is left to fix, and what of it blocks the export.
    issueCount: { type: Number, default: 0 },
    blockingCount: { type: Number, default: 0 },
    checksTotal: { type: Number, default: 0 },
    ranAt: { type: Date, default: null },
    remoteStatus: { type: String, default: 'idle' },
    remoteError: { type: String, default: null },
    t: { type: Function, required: true },
  },
  computed: {
    verdict() {
      return verdictOf(
        {
          ready: this.ready,
          issueCount: this.issueCount,
          blockingCount: this.blockingCount,
        },
        this.t
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
  template: `
    <div class="qc-summary">
      <div v-if="status === 'stale'" class="qc-stale" role="status">
        <span class="lucide lucide-rotate-ccw" aria-hidden="true"></span>
        <!-- « Relancer » is the panel's foot. -->
        <span class="qc-stale__text">{{ t('The results date from before your last changes') }}</span>
      </div>

      <!-- Where the email stands (boards q2, q3): ready, or what is left
           to fix and what of it blocks. Results of an earlier version say
           nothing: the banner above says to run again. -->
      <div v-if="status === 'done' && remoteStatus !== 'running'" class="qc-status" :class="'qc-status--' + verdict.kind">
        <!-- Ready: the icon beside the text; else inline with the title (q2, q3). -->
        <span v-if="verdict.kind === 'ready'" :class="['lucide', verdict.icon, 'qc-status__icon']" aria-hidden="true"></span>
        <div class="qc-status__body">
          <p class="qc-status__title"><span v-if="verdict.kind !== 'ready'" :class="['lucide', verdict.icon, 'qc-status__icon']" aria-hidden="true"></span>{{ verdict.title }}</p>
          <p class="qc-status__text">
            <template v-if="verdict.kind === 'ready'">
              {{ t('quality-ready-text', { count: checksTotal, when: lastRunLabel }) }}
              <template v-if="counts.info"> {{ t('quality-ready-infos', { count: counts.info }) }}</template>
            </template>
            <!-- A server check that failed says why, here alone. -->
            <template v-else-if="verdict.kind === 'incomplete' && remoteStatus === 'error'">{{ remoteErrorText }}</template>
            <template v-else>{{ t(verdict.textKey) }}</template>
          </p>
        </div>
      </div>

      <p v-if="remoteStatus === 'running'" class="qc-remote">
        <span class="qc-spinner" aria-hidden="true"></span>{{ t('Checking links and images…') }}
      </p>
      <p v-if="remoteStatus === 'error' && !(status === 'done' && verdict.kind === 'incomplete')" class="qc-remote qc-remote--error" role="status">
        <span class="lucide lucide-circle-help" aria-hidden="true"></span>{{ remoteErrorText }}
      </p>
    </div>
  `,
});

module.exports = { QualitySummary };
