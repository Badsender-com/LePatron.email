'use strict';

const Vue = require('vue/dist/vue.common');
const axios = require('axios');
const ko = require('knockout');
const { ModalComponent } = require('../modal/modalComponent');
const { generateSubjects, generatePreheaders } = require('../../utils/apis');
const {
  extractEmailCopy,
} = require('../../../ext/text-generation/email-copy');
const {
  findPreheader,
  writePreheader,
} = require('../../../ext/text-generation/template-preheader');
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

const emptyStep = () => ({
  proposals: [],
  dropped: 0,
  // Every proposal shown so far: "Suggest others" asks the skill to move away
  // from them.
  seen: [],
  selectedIndex: null,
  copiedIndex: null,
});

/**
 * Subject, then preheader, for the email being edited (epic #1163, ADR 0003).
 *
 * Three subjects; the user picks one; three preheaders built from it; the user
 * picks one; both are applied together. The text sent is the one on screen,
 * saved or not. Nothing is written until the user applies, and a field the
 * email does not have — no metadata, no preheader in the template — turns into
 * a copy button instead.
 */
const TextGenerationModalComponent = Vue.component('TextGenerationModal', {
  components: { ModalComponent },
  props: {
    vm: { type: Object, default: () => ({}) },
  },
  data: () => ({
    step: 'brief',
    brief: '',
    subjects: emptyStep(),
    preheaders: emptyStep(),
    isLoading: false,
    error: null,
    // Read on every open, not computed: the subject accessors are hung on the
    // viewModel by the metadata section, outside Vue's reach, and the preheader
    // depends on the template loaded.
    canApplySubject: false,
    canApplyPreheader: false,
    applied: null,
    previous: null,
  }),
  computed: {
    current() {
      return this.step === 'preheaders' ? this.preheaders : this.subjects;
    },
    canApply() {
      return this.step === 'preheaders' ? this.canApplyPreheader : this.canApplySubject;
    },
    pickedSubject() {
      const picked = this.subjects.proposals[this.subjects.selectedIndex];
      return picked ? picked.text : null;
    },
    pickedPreheader() {
      const picked = this.preheaders.proposals[this.preheaders.selectedIndex];
      return picked ? picked.text : null;
    },
  },
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
      this.canApplyPreheader = Boolean(this.templatePreheader());
      this.$refs.modalRef.openModal();
    },
    close() {
      this.$refs.modalRef.closeModal();
    },
    content() {
      return ko.toJS(this.vm.content());
    },
    templatePreheader() {
      return findPreheader(this.content());
    },
    currentSubject() {
      return typeof this.vm.getEmailSubject === 'function'
        ? this.vm.getEmailSubject()
        : undefined;
    },
    async request(kind) {
      const copy = extractEmailCopy(this.content());
      if (!copy.length) {
        this.error = this.t('text-generation-empty-email');
        return;
      }
      const state = this[kind];
      const isSubject = kind === 'subjects';
      const preheader = this.templatePreheader();
      this.error = null;
      this.isLoading = true;
      try {
        const { data } = await axios.post(
          isSubject ? generateSubjects() : generatePreheaders(),
          {
            mailingId: this.vm.metadata.id,
            content: copy,
            brief: this.brief || undefined,
            // The server takes the last 30: past that, older proposals matter
            // less than a request that keeps working.
            avoid: state.seen.length ? state.seen.slice(-MAX_AVOID) : undefined,
            ...(isSubject
              ? { currentSubject: this.currentSubject() || undefined }
              : {
                  subject: this.pickedSubject,
                  currentPreheader: (preheader && preheader.value) || undefined,
                }),
          }
        );
        this[kind] = {
          ...emptyStep(),
          proposals: data.proposals,
          dropped: data.dropped,
          seen: state.seen.concat(data.proposals.map((p) => p.text)),
        };
        this.step = kind;
      } catch (err) {
        const status = err.response && err.response.status;
        let key = 'text-generation-error-network';
        if (status) key = ERROR_KEYS[status] || 'text-generation-error-failed';
        this.error = this.t(key);
      } finally {
        this.isLoading = false;
      }
    },
    requestSubjects() {
      return this.request('subjects');
    },
    requestPreheaders() {
      return this.request('preheaders');
    },
    backToSubjects() {
      this.error = null;
      this.step = 'subjects';
    },
    // Subject and preheader together, so one undo takes both back.
    apply({ withPreheader }) {
      const subject = this.canApplySubject ? this.pickedSubject : null;
      const preheader =
        withPreheader && this.canApplyPreheader ? this.pickedPreheader : null;
      if (!subject && !preheader) return;
      const templatePreheader = this.templatePreheader();
      this.previous = {
        subject: subject ? this.currentSubject() || '' : null,
        preheader: preheader && templatePreheader ? templatePreheader.value : null,
      };
      this.write({ subject, preheader });
      this.applied = { subject, preheader };
      this.step = 'applied';
    },
    undo() {
      this.write(this.previous);
      this.step = this.applied.preheader ? 'preheaders' : 'subjects';
    },
    write({ subject, preheader }) {
      if (subject !== null) this.vm.setEmailSubject(subject);
      if (preheader !== null) {
        // One step in the editor's own undo stack too.
        this.vm.startMultiple();
        writePreheader(this.vm.content, preheader);
        this.vm.stopMultiple();
      }
    },
    async copy(index) {
      try {
        await navigator.clipboard.writeText(this.current.proposals[index].text);
        this.current.copiedIndex = index;
      } catch (err) {
        this.error = this.t('text-generation-error-copy');
      }
    },
  },
  template,
});

module.exports = { TextGenerationModalComponent };
