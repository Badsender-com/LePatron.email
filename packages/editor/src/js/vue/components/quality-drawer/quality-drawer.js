const Vue = require('vue/dist/vue.common');
const {
  QualityChecksPanel,
  clearHighlight,
} = require('./quality-checks-panel');
const { SendTestPanel } = require('./send-test-panel');

const TABS = [
  { name: 'checks', labelKey: 'Quality control', icon: 'lucide-shield-check' },
  { name: 'send', labelKey: 'Send a test', icon: 'lucide-send' },
];

// The quality drawer, "Test your email": the checks of the email and sending
// a test of it, as two tabs. Its state lives on the view model
// (viewModel.quality, see ext/quality/quality-review.js); this only shows it.
const QualityDrawer = Vue.component('QualityDrawer', {
  components: { QualityChecksPanel, SendTestPanel },
  props: {
    vm: { type: Object, required: true },
  },
  data: () => ({
    open: false,
    tab: 'checks',
    status: 'idle',
    findings: [],
    ignoredFindings: [],
    checks: [],
    ranAt: null,
    errorCount: 0,
    subscriptions: [],
    tabs: TABS,
  }),
  computed: {
    currentTab() {
      return TABS.find((tab) => tab.name === this.tab) || TABS[0];
    },
  },
  watch: {
    open(isOpen) {
      if (isOpen) {
        this.$nextTick(() => this.$refs.close && this.$refs.close.focus());
        return;
      }
      clearHighlight();
      // Focus goes back to the toolbar button that opened the drawer.
      if (this.$el.contains(document.activeElement)) {
        const toggle = document.getElementById('quality-toggle');
        if (toggle) toggle.focus();
      }
    },
  },
  mounted() {
    const q = this.vm.quality;
    this.sync();
    this.subscriptions = [
      this.vm.showQuality,
      q.tab,
      q.status,
      q.findings,
      q.ignored,
      q.checks,
      q.ranAt,
    ].map((observable) => observable.subscribe(this.sync));
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    sync() {
      const q = this.vm.quality;
      this.open = this.vm.showQuality();
      this.tab = q.tab();
      this.status = q.status();
      this.findings = q.activeFindings();
      this.ignoredFindings = q.ignoredFindings();
      this.checks = q.checks();
      this.ranAt = q.ranAt();
      this.errorCount = q.errorCount();
    },
    select(name) {
      this.vm.quality.tab(name);
    },
    // Arrow keys move between tabs, as in any tablist.
    onTabKey(event) {
      const i = TABS.findIndex((tab) => tab.name === this.tab);
      const next = TABS[(i + (event.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
      this.select(next.name);
      this.$nextTick(() => this.$refs[`tab-${next.name}`][0].focus());
    },
    runFromSend() {
      this.select('checks');
      this.vm.quality.run();
    },
    close() {
      this.vm.showQuality(false);
    },
  },
  template: `
    <section
      class="qc-drawer"
      role="dialog"
      aria-modal="false"
      aria-labelledby="qc-drawer-title"
      @keydown.esc="close"
    >
      <header class="qc-drawer__header">
        <div>
          <p class="qc-drawer__eyebrow">{{ t('Test your email') }}</p>
          <h2 id="qc-drawer-title" class="qc-drawer__title">{{ t(currentTab.labelKey) }}</h2>
        </div>
        <button ref="close" type="button" class="qc-icon-button" :aria-label="t('Close')" :title="t('Close')" @click="close">
          <span class="lucide lucide-x" aria-hidden="true"></span>
        </button>
      </header>

      <div class="qc-tabs" role="tablist" :aria-label="t('Test your email')" @keydown.right.prevent="onTabKey" @keydown.left.prevent="onTabKey">
        <button
          v-for="item in tabs"
          :key="item.name"
          :ref="'tab-' + item.name"
          type="button"
          role="tab"
          class="qc-tab"
          :class="{ 'qc-tab--active': tab === item.name }"
          :id="'qc-tab-' + item.name"
          :aria-selected="tab === item.name ? 'true' : 'false'"
          :aria-controls="'qc-tabpanel-' + item.name"
          :tabindex="tab === item.name ? 0 : -1"
          @click="select(item.name)"
        >
          <span :class="['lucide', item.icon]" aria-hidden="true"></span>{{ t(item.labelKey) }}
        </button>
      </div>

      <quality-checks-panel
        v-show="tab === 'checks'"
        id="qc-tabpanel-checks"
        role="tabpanel"
        aria-labelledby="qc-tab-checks"
        class="qc-drawer__tabpanel"
        :vm="vm"
        :status="status"
        :findings="findings"
        :ignored-findings="ignoredFindings"
        :checks="checks"
        :ran-at="ranAt"
        @send-test="select('send')"
      ></quality-checks-panel>
      <send-test-panel
        v-show="tab === 'send'"
        id="qc-tabpanel-send"
        role="tabpanel"
        aria-labelledby="qc-tab-send"
        class="qc-drawer__tabpanel"
        :vm="vm"
        :status="status"
        :error-count="errorCount"
        @show-results="select('checks')"
        @run-checks="runFromSend"
      ></send-test-panel>
    </section>
  `,
});

module.exports = { QualityDrawer };
