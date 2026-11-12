const Vue = require('vue/dist/vue.common');
const { RecipientsField } = require('./recipients-field');
const { ShareLinkPanel } = require('./share-link-panel');
const {
  fetchEmailGroups,
  sendTestEmail,
} = require('../send-test/send-test-api');
const { formatTime } = require('./quality-items');

// The "Send a test" tab of the quality drawer: the recipients, an optional
// saved list, and a word on what the quality review found. What is left to
// fix never stops the send: it is only recalled, with a way back to the
// results; in red only when something blocks the export (decision 6).
//
// Escape in the recipients field closes the drawer, as anywhere in it: the
// drawer is a non-modal dialog, and what was typed stays (the tab is only
// hidden, never destroyed).
const SendTestPanel = Vue.component('SendTestPanel', {
  components: { RecipientsField, ShareLinkPanel },
  props: {
    vm: { type: Object, required: true },
    // What the last review found: 'idle' | 'running' | 'done' | 'stale'.
    status: { type: String, default: 'idle' },
    // The ready rule (ADR 0020), and what is left to fix when not ready.
    ready: { type: Boolean, default: false },
    issueCount: { type: Number, default: 0 },
    blockingCount: { type: Number, default: 0 },
    // The server's checks of links and images, still awaited when 'running'.
    remoteStatus: { type: String, default: 'idle' },
    // The tab is shown.
    active: { type: Boolean, default: false },
  },
  data: () => ({
    // The addresses and the saved list, as chips (recipients-field.js).
    chips: [],
    // An address typed and not yet a chip: enough to send, once checked.
    hasDraft: false,
    emailGroups: [],
    groupsRequested: false,
    isSending: false,
    // The last test sent: { count, at }.
    sent: null,
  }),
  computed: {
    recipients() {
      return this.chips
        .filter((chip) => chip.kind === 'email')
        .map((chip) => chip.value)
        .join(';');
    },
    selectedGroup() {
      return this.chips.find((chip) => chip.kind === 'list') || null;
    },
    recipientCount() {
      return this.chips.reduce(
        (sum, chip) => sum + (chip.kind === 'list' ? chip.count || 0 : 1),
        0
      );
    },
    canSend() {
      return !this.isSending && (this.chips.length > 0 || this.hasDraft);
    },
    // What the panel's foot shows of the send (quality-drawer.js).
    state() {
      return {
        canSend: this.canSend,
        isSending: this.isSending,
        sent: Boolean(this.sent),
      };
    },
  },
  watch: {
    state: {
      immediate: true,
      handler(state) {
        this.$emit('state', state);
      },
    },
    // The saved lists are asked for the first time the tab is shown: most
    // editing sessions never open it.
    active: {
      immediate: true,
      handler(isActive) {
        if (isActive && !this.groupsRequested) this.loadGroups();
      },
    },
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    sentAt() {
      return this.sent ? formatTime(this.sent.at) : '';
    },
    loadGroups() {
      this.groupsRequested = true;
      fetchEmailGroups(this.vm)
        .then((groups) => {
          this.emailGroups = groups;
        })
        .catch((error) => {
          console.error('Loading the lists of addresses failed', error);
          this.vm.notifier.error(
            this.t('The saved lists of addresses could not be loaded')
          );
        });
    },
    send() {
      // An address typed and not yet a chip joins the others first.
      const field = this.$refs.recipients;
      if (field && !field.commit()) return;
      if (!this.canSend) return;
      // One export: the quality review judges the very HTML that is sent,
      // without opening anything (the user is sending, not reviewing).
      let html;
      try {
        html = this.vm.exportHTML();
      } catch (error) {
        // Nothing to send; a second export would only fail again.
        console.error('Exporting the test failed', error);
        this.vm.notifier.error(this.t('send-test-error'));
        return;
      }
      this.isSending = true;
      try {
        if (this.vm.quality) this.vm.quality.review({ html, silent: true });
      } catch (error) {
        console.error('Quality review of the test failed', error);
      }
      sendTestEmail(this.vm, {
        recipients: this.recipients,
        emailsGroupId: this.selectedGroup && this.selectedGroup.code,
        html,
      })
        // Said in the tab (board q5): the count is the server's, the typed
        // addresses and the list's without their duplicates.
        .then((response) => {
          const data = (response && response.data) || {};
          this.sent = {
            count: Array.isArray(data.result)
              ? data.result.length
              : this.recipientCount,
            at: new Date(),
            // The subject the server sent it with, saved or not here
            // (board q5).
            subject: typeof data.subject === 'string' ? data.subject : '',
          };
        })
        .catch(() => this.vm.notifier.error(this.t('send-test-error')))
        .finally(() => {
          // The drawer stays open: the user may send again, or go on fixing.
          this.isSending = false;
        });
    },
  },
  template: `
    <div class="qc-send">
      <div v-if="status === 'running' || (status === 'done' && remoteStatus === 'running')" class="qc-notice" role="status">
        <span class="qc-spinner" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ status === 'running' ? t('Running checks…') : t('Checking links and images…') }}</span>
      </div>
      <!-- Red only when something blocks the export (decision 6). -->
      <div v-else-if="status === 'done' && !ready" class="qc-notice" :class="blockingCount > 0 ? 'qc-notice--error' : 'qc-notice--neutral'" role="status">
        <span class="lucide" :class="blockingCount > 0 ? 'lucide-alert-circle' : issueCount ? 'lucide-triangle-alert' : 'lucide-circle-slash'" aria-hidden="true"></span>
        <!-- The link at the end of the sentence, as on board q4. -->
        <span class="qc-notice__text">{{ issueCount ? t(issueCount === 1 ? 'quality-send-not-ready-one' : 'quality-send-not-ready', { count: issueCount }) : t('A check could not run: you can send a test anyway') }}
          <button type="button" class="qc-link-button" @click="$emit('show-results')">{{ t('quality-see-checks') }}</button></span>
      </div>
      <div v-else-if="status === 'idle' || status === 'stale'" class="qc-notice" role="status">
        <span class="lucide lucide-info" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ t('The quality checks have not run on this version yet') }}
          <button type="button" class="qc-link-button" @click="$emit('run-checks')">{{ t('Run quality checks') }}</button></span>
      </div>

      <div v-if="sent" class="qc-notice qc-notice--success" role="status">
        <span class="lucide lucide-check-circle" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ t(sent.count === 1 ? 'quality-test-sent-one' : 'quality-test-sent', { count: sent.count, when: sentAt() }) }}<template v-if="sent.subject"> {{ t('quality-test-sent-subject', { subject: sent.subject }) }}</template></span>
      </div>

      <!-- Sent from the panel's foot: its button names this form. -->
      <form id="qc-send-form" class="qc-send__form" @submit.prevent="send">
        <recipients-field
          ref="recipients"
          v-model="chips"
          :lists="emailGroups"
          :label="t('quality-recipients')"
          :t="t"
          @draft="hasDraft = $event"
        ></recipients-field>
      </form>

      <share-link-panel :vm="vm" :active="active"></share-link-panel>
    </div>
  `,
});

module.exports = { SendTestPanel };
