const Vue = require('vue/dist/vue.common');
const { SimpleSelect } = require('../select/simpleSelect');
const { ShareLinkPanel } = require('./share-link-panel');
const {
  areEmails,
  fetchEmailGroups,
  sendTestEmail,
} = require('../send-test/send-test-api');

// The "Send a test" tab of the quality drawer: the recipients, an optional
// saved list, and a word on what the quality review found. Errors never stop
// the send: they are only recalled, with a way back to the results.
//
// Escape in the recipients field closes the drawer, as anywhere in it: the
// drawer is a non-modal dialog, and what was typed stays (the tab is only
// hidden, never destroyed).
const SendTestPanel = Vue.component('SendTestPanel', {
  components: { SimpleSelect, ShareLinkPanel },
  props: {
    vm: { type: Object, required: true },
    // What the last review found: 'idle' | 'running' | 'done' | 'stale',
    // and its error count.
    status: { type: String, default: 'idle' },
    errorCount: { type: Number, default: 0 },
    // The tab is shown.
    active: { type: Boolean, default: false },
  },
  data: () => ({
    recipients: '',
    emailGroups: [],
    groupsRequested: false,
    selectedGroup: null,
    touched: false,
    isSending: false,
  }),
  computed: {
    recipientsValid() {
      return areEmails(this.recipients);
    },
    canSend() {
      const hasTarget =
        this.recipients.trim() ||
        (this.selectedGroup && this.selectedGroup.code);
      return !this.isSending && this.recipientsValid && Boolean(hasTarget);
    },
  },
  watch: {
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
      this.touched = true;
      if (!this.canSend) return;
      this.isSending = true;
      // One export: the quality review judges the very HTML that is sent,
      // without opening anything (the user is sending, not reviewing).
      let html;
      try {
        html = this.vm.exportHTML();
        if (this.vm.quality) this.vm.quality.review({ html, silent: true });
      } catch (error) {
        console.error('Quality review of the test failed', error);
      }
      sendTestEmail(this.vm, {
        recipients: this.recipients,
        emailsGroupId: this.selectedGroup && this.selectedGroup.code,
        html,
      })
        .then(() => this.vm.notifier.success(this.t('send-test-success')))
        .catch(() => this.vm.notifier.error(this.t('send-test-error')))
        .finally(() => {
          // The drawer stays open: the user may send again, or go on fixing.
          this.isSending = false;
        });
    },
  },
  template: `
    <div class="qc-send">
      <div v-if="status === 'running'" class="qc-notice" role="status">
        <span class="qc-spinner" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ t('Running checks…') }}</span>
      </div>
      <div v-else-if="status === 'done' && errorCount" class="qc-notice qc-notice--error" role="status">
        <span class="lucide lucide-alert-circle" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ t('__count__ errors are still to fix: you can send a test anyway', { count: errorCount }) }}</span>
        <button type="button" class="qc-link-button" @click="$emit('show-results')">{{ t('See the results') }}</button>
      </div>
      <div v-else-if="status === 'idle' || status === 'stale'" class="qc-notice" role="status">
        <span class="lucide lucide-info" aria-hidden="true"></span>
        <span class="qc-notice__text">{{ t('The quality checks have not run on this version yet') }}</span>
        <button type="button" class="qc-link-button" @click="$emit('run-checks')">{{ t('Run quality checks') }}</button>
      </div>

      <form class="qc-send__form" @submit.prevent="send">
        <div class="qc-field">
          <label for="qc-send-recipients" class="qc-field__label">{{ t('emails-test') }}</label>
          <input
            id="qc-send-recipients"
            v-model="recipients"
            type="text"
            class="qc-field__input"
            :class="{ 'qc-field__input--invalid': touched && !recipientsValid }"
            :placeholder="t('placeholder-input-emails-test')"
            :aria-invalid="touched && !recipientsValid ? 'true' : 'false'"
            aria-describedby="qc-send-help"
            @blur="touched = true"
          >
          <span id="qc-send-help" class="qc-field__help" :class="{ 'qc-field__help--error': touched && !recipientsValid }">
            {{ touched && !recipientsValid ? t('emails-invalid') : t('Separate addresses with a semicolon') }}
          </span>
        </div>

        <div v-if="emailGroups.length" class="qc-field">
          <span id="qc-send-groups-label" class="qc-field__label">{{ t('Saved list of addresses') }}</span>
          <SimpleSelect
            v-model="selectedGroup"
            labelledby="qc-send-groups-label"
            :placeholder="t('placeholder-emails-groups')"
            :options="emailGroups"
          />
        </div>

        <button type="submit" class="qc-button qc-button--cta qc-send__submit" :disabled="!canSend">
          <span class="lucide lucide-send" aria-hidden="true"></span>
          {{ isSending ? t('sending-test-mails') : t('Send the test email') }}
        </button>
      </form>

      <share-link-panel :vm="vm" :active="active"></share-link-panel>
    </div>
  `,
});

module.exports = { SendTestPanel };
