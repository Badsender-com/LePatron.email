const Vue = require('vue/dist/vue.common');
const { formatTime } = require('./quality-items');

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
    // 'ready', 'blocking' (red: it stops the export, decision 6), 'todo',
    // or 'incomplete' (a check could not run).
    verdict() {
      if (this.ready) return 'ready';
      if (this.blockingCount) return 'blocking';
      return this.issueCount ? 'todo' : 'incomplete';
    },
    verdictIcon() {
      return {
        ready: 'lucide-check-circle',
        blocking: 'lucide-lock',
        todo: 'lucide-triangle-alert',
        incomplete: 'lucide-circle-slash',
      }[this.verdict];
    },
    verdictTitle() {
      const count = this.issueCount;
      return {
        ready: this.t('quality-ready-title'),
        blocking: this.t('quality-not-ready-blocking', {
          count,
          blocking: this.blockingCount,
        }),
        todo: this.t('quality-not-ready', { count }),
        incomplete: this.t('quality-not-run-title'),
      }[this.verdict];
    },
    verdictText() {
      return this.t(
        {
          blocking: 'quality-blocking-text',
          todo: 'quality-not-ready-text',
          incomplete: 'quality-not-run-text',
        }[this.verdict]
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
      <div v-if="status === 'done' && remoteStatus !== 'running'" class="qc-status" :class="'qc-status--' + verdict">
        <span :class="['lucide', verdictIcon, 'qc-status__icon']" aria-hidden="true"></span>
        <div class="qc-status__body">
          <p class="qc-status__title">{{ verdictTitle }}</p>
          <p class="qc-status__text">
            <template v-if="verdict === 'ready'">
              {{ t('quality-ready-text', { count: checksTotal, when: lastRunLabel }) }}
              <template v-if="counts.info"> {{ t('quality-ready-infos', { count: counts.info }) }}</template>
            </template>
            <template v-else>{{ verdictText }}</template>
          </p>
        </div>
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
