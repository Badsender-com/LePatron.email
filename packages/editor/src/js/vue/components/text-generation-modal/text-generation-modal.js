'use strict';

const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const ko = require('knockout');
const { ModalComponent } = require('../modal/modalComponent');
const { generateSubjects } = require('../../utils/apis');
const {
  extractEmailCopy,
} = require('../../../ext/text-generation/email-copy');
const template = require('./text-generation-modal.template');

// Proposals already seen that "Suggest others" sends back (server limit).
const MAX_AVOID = 30;

// What the user can act on, by status of the text generation routes.
const ERROR_KEYS = {
  403: 'text-generation-error-disabled',
  413: 'text-generation-error-too-large',
  429: 'text-generation-error-rate-limited',
  502: 'text-generation-error-failed',
  503: 'text-generation-error-unavailable',
};

/**
 * Subject proposals for the email being edited (epic #1163, ADR 0003).
 *
 * The text sent is the one on screen, saved or not. Nothing is written into the
 * email until the user picks a proposal; when the group does not manage the
 * subject in LePatron, each proposal is offered to copy instead.
 */
const TextGenerationModalComponent = Vue.component('TextGenerationModal', {
  components: { ModalComponent },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    step: 'brief',
    brief: '',
    proposals: [],
    dropped: 0,
    // Every proposal shown so far: "Suggest others" asks the skill to move away
    // from them.
    seen: [],
    selectedIndex: null,
    copiedIndex: null,
    previousSubject: null,
    appliedSubject: null,
    isLoading: false,
    error: null,
    // Read on every open, not computed: the accessors are hung on the viewModel
    // by the metadata section, outside Vue's reach, and exist only while that
    // section is mounted.
    canApplySubject: false,
  }),
  mounted() {
    this.vm.toggleTextGenerationModal = this.open;
  },
  methods: {
    t(key, params) {
      return this.vm.t(key, params);
    },
    open() {
      Object.assign(this, this.$options.data());
      this.canApplySubject = typeof this.vm.setEmailSubject === 'function';
      this.$refs.modalRef.openModal();
    },
    close() {
      this.$refs.modalRef.closeModal();
    },
    currentSubject() {
      return typeof this.vm.getEmailSubject === 'function'
        ? this.vm.getEmailSubject()
        : undefined;
    },
    async requestSubjects() {
      const content = extractEmailCopy(ko.toJS(this.vm.content()));
      if (!content.length) {
        this.error = this.t('text-generation-empty-email');
        return;
      }
      this.error = null;
      this.isLoading = true;
      try {
        const { data } = await axios.post(generateSubjects(), {
          mailingId: this.vm.metadata.id,
          content,
          currentSubject: this.currentSubject() || undefined,
          brief: this.brief || undefined,
          // The server takes the last 30: past that, older proposals matter less
          // than a request that keeps working.
          avoid: this.seen.length ? this.seen.slice(-MAX_AVOID) : undefined,
        });
        this.proposals = data.proposals;
        this.dropped = data.dropped;
        this.seen = this.seen.concat(data.proposals.map((p) => p.text));
        this.selectedIndex = null;
        this.copiedIndex = null;
        this.step = 'subjects';
      } catch (err) {
        const status = err.response && err.response.status;
        let key = 'text-generation-error-network';
        if (status) key = ERROR_KEYS[status] || 'text-generation-error-failed';
        this.error = this.t(key);
      } finally {
        this.isLoading = false;
      }
    },
    applySubject() {
      const proposal = this.proposals[this.selectedIndex];
      if (!proposal) return;
      this.previousSubject = this.currentSubject() || '';
      this.vm.setEmailSubject(proposal.text);
      this.appliedSubject = proposal.text;
      this.step = 'applied';
    },
    // One step back: the subject sits outside the editor's undo stack.
    undo() {
      this.vm.setEmailSubject(this.previousSubject);
      this.step = 'subjects';
    },
    async copy(index) {
      try {
        await navigator.clipboard.writeText(this.proposals[index].text);
        this.copiedIndex = index;
      } catch (err) {
        this.error = this.t('text-generation-error-copy');
      }
    },
  },
  template,
});

module.exports = { TextGenerationModalComponent };
