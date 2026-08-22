'use strict';

const Vue = require('vue/dist/vue.common');
const axios = require('axios');

const {
  subjectCounter,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
  errorKeyFor,
  SUBJECT_HARD_LIMIT,
} = require('../utils/email-metadata');
const template = require('./components/email-metadata/email-metadata.template');

// The mounted Vue instance, kept so `dispose` can tear it down when the editor
// swaps templates (template-loader.js:623 calls the hook).
let app = null;

/**
 * The "Metadata" section of the Content tab: subject, planned send date, typology.
 *
 * A section, not a panel. The first implementation followed the comments panel —
 * a slidebar opened from the top bar — and that was the wrong precedent: a comment
 * is an annotation laid on the email, transient; metadata is a setting of the
 * document, persistent. The Content tab already holds exactly that family of
 * document-level properties in Template Options, and brand and language will join
 * them later as variant axes. So the section sits there, between Template Options
 * and the tracking section: Template Options keeps the position users already
 * know, and the two Badsender-added document sections stay together.
 *
 * One save, one mechanism: `PATCH /mailings/:id/metadata`. The preheader is not
 * here — it is a template property, edited in Template Options as it always has
 * been, and bringing it in would mean changing how our templates declare it.
 * There is therefore no second save path any more.
 *
 * The field decisions live in utils/email-metadata.js: the editor has no
 * component test harness, so anything left in this file is untested.
 *
 * Styled by badsender-email-metadata.less rather than through `bs-form-field`:
 * that class is imported INSIDE badsender-modal.less, so it only exists under a
 * modal scope and reaches nothing here.
 */
module.exports = {
  viewModel(vm, ko) {
    // Presence of the config is what decides the section exists. An opted-out
    // company gets neither key from findOneForMosaico, so the section is not
    // rendered at all.
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    vm.hasEmailMetadata = ko.observable(Boolean(config && config.enabled));
  },

  init(vm) {
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    if (!config || !config.enabled) return;

    const values = (vm.metadata && vm.metadata.emailMetadata) || {};
    const initialForm = toFormState(values);

    Vue.component('EmailMetadataPlugin', {
      data: () => ({
        subject: initialForm.subject,
        plannedSendDate: initialForm.plannedSendDate,
        emailTypeId: initialForm.emailTypeId,
        initial: { ...initialForm },
        emailTypes: config.emailTypes || [],
        subjectHardLimit: SUBJECT_HARD_LIMIT,
        isSaving: false,
        feedback: null,
      }),

      computed: {
        subjectCount() {
          return subjectCounter(this.subject);
        },
        typologyChoices() {
          return typologyOptions(
            this.emailTypes,
            this.emailTypeId,
            vm.t('email-metadata-typology-none'),
            vm.t('email-metadata-typology-missing')
          );
        },
        hasChanges() {
          return hasMetadataChanges(
            {
              subject: this.subject,
              plannedSendDate: this.plannedSendDate,
              emailTypeId: this.emailTypeId,
            },
            this.initial
          );
        },
      },

      watch: {
        subject() {
          this.feedback = null;
        },
        plannedSendDate() {
          this.feedback = null;
        },
        emailTypeId() {
          this.feedback = null;
        },
      },

      methods: {
        // The second argument matters: vm.t(key, params) interpolates __token__
        // placeholders, and dropping it would lose them without an error.
        t: (key, params) => vm.t(key, params),

        counterLabel(count) {
          return vm.t('email-metadata-counter', {
            length: count.length,
            min: count.min,
            max: count.max,
          });
        },

        async save() {
          if (this.isSaving || !this.hasChanges) return;
          this.isSaving = true;
          this.feedback = null;

          const snapshot = {
            subject: this.subject,
            plannedSendDate: this.plannedSendDate,
            emailTypeId: this.emailTypeId,
          };

          try {
            await axios.patch(config.url.update, buildMetadataPayload(snapshot));
            this.initial = snapshot;
            this.feedback = { type: 'success', key: 'email-metadata-saved' };
          } catch (error) {
            this.feedback = { type: 'error', key: errorKeyFor(error) };
          } finally {
            this.isSaving = false;
          }
        },
      },

      template,
    });

    app = new Vue({ el: '#email-metadata-section' });
  },

  // Called by the template loader when the editor swaps templates. Without it the
  // Vue instance outlives its node and keeps a closure over a stale config.
  dispose() {
    if (app) {
      app.$destroy();
      app = null;
    }
  },
};
