const Vue = require('vue/dist/vue.common');
const {
  QualityChecksPanel,
  clearHighlight,
} = require('./quality-checks-panel');
const { SendTestPanel } = require('./send-test-panel');
const { CAPABILITIES } = require('../../../../../../shared/access/roles.js');
const koMirror = require('../../mixins/ko-mirror');
const { RightPanelShell } = require('../right-panel/right-panel-shell');

// Frozen: the template reads it, and Vue would otherwise make it reactive.
const TABS = Object.freeze([
  Object.freeze({ name: 'checks', labelKey: 'Quality control' }),
  Object.freeze({ name: 'send', labelKey: 'Send a test' }),
]);

// The quality drawer, "Test your email": the checks of the email and sending
// a test of it, as two tabs. Its state lives on the view model
// (viewModel.quality, see ext/quality/quality-review.js); this only shows it.
const QualityDrawer = Vue.component('QualityDrawer', {
  components: { QualityChecksPanel, SendTestPanel, RightPanelShell },
  mixins: [koMirror],
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
    ready: false,
    issueCount: 0,
    blockingCount: 0,
    // What the send test tab's foot shows (send-test-panel.js).
    sendState: { canSend: false, isSending: false, sent: false },
    // Ignoring is shared by everyone who edits the email, so it takes the
    // same right: a reviewer sees the button, greyed out.
    ignoreLocked: true,
  }),
  watch: {
    // Focus and Escape are the right panel's (ext/right-panel.js): the drawer
    // only clears what it highlighted in the canvas.
    open(isOpen) {
      if (!isOpen) clearHighlight();
    },
  },
  created() {
    this.tabs = TABS;
  },
  mounted() {
    const q = this.vm.quality;
    // Each observable feeds its own field: a change repaints only what it
    // touches, instead of every list on every notification.
    this.mirror(this.vm.showQuality, (value) => (this.open = value));
    this.mirror(q.tab, (value) => (this.tab = value));
    this.mirror(q.status, (value) => (this.status = value));
    this.mirror(q.remoteStatus, (value) => (this.remoteStatus = value));
    this.mirror(q.remoteError, (value) => (this.remoteError = value));
    this.mirror(q.activeFindings, (value) => (this.findings = value));
    this.mirror(q.ignoredFindings, (value) => (this.ignoredFindings = value));
    this.mirror(q.checks, (value) => (this.checks = value));
    this.mirror(q.ranAt, (value) => (this.ranAt = value));
    this.mirror(q.ready, (value) => (this.ready = value));
    this.mirror(q.issueCount, (value) => (this.issueCount = value));
    this.mirror(q.blockingCount, (value) => (this.blockingCount = value));
    // The editor opens before the user is known: locked until they are.
    this.mirror(this.vm.currentUser, () => {
      this.ignoreLocked = !this.vm.userCan(CAPABILITIES.MAILING_EDIT_CONTENT);
    });
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
    // Arrow keys move between tabs, Home and End to the ends, as in any
    // tablist.
    onTabKey(event) {
      if (event.key === 'Home' || event.key === 'End') {
        this.goTo(TABS[event.key === 'Home' ? 0 : TABS.length - 1].name);
        return;
      }
      const i = TABS.findIndex((tab) => tab.name === this.tab);
      const step = event.key === 'ArrowRight' ? 1 : TABS.length - 1;
      this.goTo(TABS[(i + step) % TABS.length].name);
    },
    run() {
      clearHighlight();
      this.vm.quality.run();
    },
    runFromSend() {
      this.goTo('checks');
      this.run();
    },
  },
  template: `
    <right-panel-shell
      class="qc-drawer"
      title-id="qc-drawer-title"
      :title="t('Test email')"
      :close-label="t('right-panel-close')"
      @close="vm.rightPanel.hide()"
    >
      <template v-slot:nav>
      <div class="qc-tabs" role="tablist" @keydown.right.prevent="onTabKey" @keydown.left.prevent="onTabKey" @keydown.home.prevent="onTabKey" @keydown.end.prevent="onTabKey">
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
          {{ t(item.labelKey) }}
        </button>
      </div>
      </template>

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
        :ready="ready"
        :issue-count="issueCount"
        :blocking-count="blockingCount"
        :ignore-locked="ignoreLocked"
      ></quality-checks-panel>
      <send-test-panel
        v-show="tab === 'send'"
        id="qc-tabpanel-send"
        role="tabpanel"
        aria-labelledby="qc-tab-send"
        class="qc-drawer__tabpanel"
        :vm="vm"
        :status="status"
        :ready="ready"
        :issue-count="issueCount"
        :blocking-count="blockingCount"
        :remote-status="remoteStatus"
        :active="open && tab === 'send'"
        @show-results="goTo('checks')"
        @state="sendState = $event"
        @run-checks="runFromSend"
      ></send-test-panel>

      <!-- The checks' actions, in the panel's foot (boards q1 to q3). -->
      <template v-if="tab === 'checks'" v-slot:footer>
        <button v-if="status === 'idle'" type="button" class="qc-button qc-button--cta" @click="run">
          <span class="lucide lucide-play" aria-hidden="true"></span>{{ t('quality-run') }}
        </button>
        <button v-else-if="status === 'running'" type="button" class="qc-button qc-button--outline" @click="vm.quality.cancel()">
          {{ t('quality-action-cancel') }}
        </button>
        <!-- Results of an earlier version: running again comes first. -->
        <template v-else>
          <button type="button" :class="['qc-button', status === 'stale' ? 'qc-button--cta' : 'qc-button--outline']" @click="run">
            <span class="lucide lucide-refresh-cw" aria-hidden="true"></span>{{ t('Re-run') }}
          </button>
          <button type="button" :class="['qc-button', status === 'stale' ? 'qc-button--outline' : 'qc-button--cta']" @click="goTo('send')">
            {{ t('quality-send-a-test') }}
          </button>
        </template>
      </template>
      <template v-else v-slot:footer>
        <button type="submit" form="qc-send-form" class="qc-button qc-button--cta" :disabled="!sendState.canSend">
          <span class="lucide lucide-send" aria-hidden="true"></span>{{ sendState.isSending ? t('sending-test-mails') : sendState.sent ? t('quality-send-again') : t('quality-send-test') }}
        </button>
      </template>
    </right-panel-shell>
  `,
});

module.exports = { QualityDrawer };
