const Vue = require('vue/dist/vue.common');
const {
  QualityChecksPanel,
  clearHighlight,
} = require('./quality-checks-panel');
const { SendTestPanel } = require('./send-test-panel');

// Frozen: the template reads it, and Vue would otherwise make it reactive.
const TABS = Object.freeze([
  Object.freeze({
    name: 'checks',
    labelKey: 'Quality control',
    icon: 'lucide-shield-check',
  }),
  Object.freeze({ name: 'send', labelKey: 'Send a test', icon: 'lucide-send' }),
]);

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
    remoteStatus: 'idle',
    remoteError: null,
    findings: [],
    ignoredFindings: [],
    checks: [],
    ranAt: null,
    errorCount: 0,
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
  created() {
    this.tabs = TABS;
    this.subscriptions = [];
  },
  mounted() {
    const q = this.vm.quality;
    // Each observable feeds its own field: a change repaints only what it
    // touches, instead of every list on every notification.
    const bind = (observable, apply) => {
      apply(observable());
      return observable.subscribe(apply);
    };
    this.subscriptions = [
      bind(this.vm.showQuality, (value) => (this.open = value)),
      bind(q.tab, (value) => (this.tab = value)),
      bind(q.status, (value) => (this.status = value)),
      bind(q.remoteStatus, (value) => (this.remoteStatus = value)),
      bind(q.remoteError, (value) => (this.remoteError = value)),
      bind(q.activeFindings, (value) => (this.findings = value)),
      bind(q.ignoredFindings, (value) => (this.ignoredFindings = value)),
      bind(q.checks, (value) => (this.checks = value)),
      bind(q.ranAt, (value) => (this.ranAt = value)),
      bind(q.errorCount, (value) => (this.errorCount = value)),
    ];
  },
  beforeDestroy() {
    this.subscriptions.forEach((subscription) => subscription.dispose());
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    select(name) {
      this.vm.quality.tab(name);
    },
    // A tab chosen from inside a panel: the button that was clicked goes
    // out of view with its panel, so the focus moves to the tab itself.
    goTo(name) {
      this.select(name);
      this.$nextTick(() => {
        const tab = this.$refs[`tab-${name}`];
        if (tab && tab[0]) tab[0].focus();
      });
    },
    // Arrow keys move between tabs, as in any tablist.
    onTabKey(event) {
      const i = TABS.findIndex((tab) => tab.name === this.tab);
      const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
      this.goTo(TABS[(i + step) % TABS.length].name);
    },
    runFromSend() {
      this.goTo('checks');
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
        <button ref="close" type="button" class="qc-icon-button" :aria-label="t('quality-action-close')" :title="t('quality-action-close')" @click="close">
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
        :remote-status="remoteStatus"
        :remote-error="remoteError"
        :findings="findings"
        :ignored-findings="ignoredFindings"
        :checks="checks"
        :ran-at="ranAt"
        @send-test="goTo('send')"
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
        :active="open && tab === 'send'"
        @show-results="goTo('checks')"
        @run-checks="runFromSend"
      ></send-test-panel>
    </section>
  `,
});

module.exports = { QualityDrawer };
