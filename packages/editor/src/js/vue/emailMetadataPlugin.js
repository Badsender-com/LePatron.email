const Vue = require('vue/dist/vue.common');
const axios = require('axios');

const {
  subjectCounter,
  preheaderCounter,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
  SUBJECT_HARD_LIMIT,
  PREHEADER_HARD_LIMIT,
} = require('../utils/email-metadata');
const { runSave, OUTCOME } = require('../utils/email-metadata-save');
const { findPreheaderObservable } = require('../utils/preheader-observable');
const template = require('./components/email-metadata/email-metadata.template');

/**
 * The "Metadata" panel: subject, preheader, planned send date, typology.
 *
 * Two save mechanisms live side by side here, which is the whole subtlety.
 *
 * Subject, date and typology go through `PATCH /mailings/:id/metadata` — they are
 * mailing fields the global save does not touch.
 *
 * The preheader is NOT patched. It is a template property: the editor holds the
 * template data in memory and rewrites it wholesale on the global save, so a
 * PATCH would be overwritten at the next save. The field therefore binds to the
 * SAME observable as the template's own preheader field — no synchronisation to
 * write, the two cannot disagree — and the panel's Save also runs the global save
 * when the preheader changed, so one click persists everything the panel shows.
 * The button says so when that is what it will do.
 *
 * The orchestration of those two writes lives in utils/email-metadata-save.js and
 * the field decisions in utils/email-metadata.js: the editor has no component
 * test harness, so anything left in this file is untested.
 *
 * The fields are styled by badsender-email-metadata.less rather than reusing
 * `bs-form-field`: that class is imported INSIDE badsender-modal.less, so it only
 * exists under a modal scope and reaches nothing in a slidebar.
 */
module.exports = {
  viewModel(vm, ko) {
    // Presence of the config is what decides the panel exists. An opted-out
    // company gets neither key from findOneForMosaico, so there is nothing to
    // toggle and the button never renders.
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    vm.hasEmailMetadata = ko.observable(Boolean(config && config.enabled));
    vm.showMetadata = ko.observable(false);

    vm.toggleMetadata = () => vm.showMetadata(!vm.showMetadata());
    // A `role="button"` that cannot be reached or activated from the keyboard is
    // a false positive: the whole panel would be mouse-only.
    vm.toggleMetadataOnKey = (data, event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        vm.toggleMetadata();
        return false;
      }
      return true;
    };

  },

  init(vm) {
    // The two right-hand panels occupy the same space: opening one over the other
    // hides it with nothing to show that happened. Wired here rather than in
    // `viewModel`, because `showComments` is created by badsender-comments, which
    // is a custom extension and therefore runs AFTER this plugin's viewModel hook
    // — subscribing there silently did nothing.
    if (vm.showComments) {
      vm.showMetadata.subscribe((open) => {
        if (open) vm.showComments(false);
      });
      vm.showComments.subscribe((open) => {
        if (open) vm.showMetadata(false);
      });
    }

    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    if (!config || !config.enabled) return;

    const values = (vm.metadata && vm.metadata.emailMetadata) || {};
    const initialForm = toFormState(values);

    // Resolved on each access rather than cached: a block recreated by an undo of
    // its deletion, or by an importJSON, is a NEW object, and a cached reference
    // would write into a detached observable with nothing to signal it.
    const preheaderBinding = () => findPreheaderObservable(vm.content);
    const initialBinding = preheaderBinding();
    const readPreheaderValue = () => {
      const found = preheaderBinding();
      if (!found) return '';
      const value = found.observable();
      return typeof value === 'string' ? value : '';
    };

    Vue.component('EmailMetadataPlugin', {
      data: () => ({
        subject: initialForm.subject,
        plannedSendDate: initialForm.plannedSendDate,
        emailTypeId: initialForm.emailTypeId,
        initial: { ...initialForm },
        preheader: initialBinding ? readPreheaderValue() : '',
        initialPreheader: initialBinding ? readPreheaderValue() : '',
        hasPreheaderField: Boolean(initialBinding),
        emailTypes: config.emailTypes || [],
        requiredFields: config.requiredFields || [],
        subjectHardLimit: SUBJECT_HARD_LIMIT,
        preheaderHardLimit: PREHEADER_HARD_LIMIT,
        isSaving: false,
        feedback: null,
      }),

      mounted() {
        // Kept off `data`: Vue would make the Knockout subscription reactive and
        // walk its internals for nothing.
        const found = preheaderBinding();
        if (!found) return;
        this._preheaderSubscription = found.observable.subscribe((value) => {
          const next = typeof value === 'string' ? value : '';
          if (next !== this.preheader) this.preheader = next;
        });
      },

      beforeDestroy() {
        if (this._preheaderSubscription) this._preheaderSubscription.dispose();
      },

      computed: {
        subjectCount() {
          return subjectCounter(this.subject);
        },
        preheaderCount() {
          return preheaderCounter(this.preheader);
        },
        typologyChoices() {
          return typologyOptions(
            this.emailTypes,
            this.emailTypeId,
            vm.t('email-metadata-typology-none'),
            vm.t('email-metadata-typology-missing')
          );
        },
        metadataChanged() {
          return hasMetadataChanges(
            {
              subject: this.subject,
              plannedSendDate: this.plannedSendDate,
              emailTypeId: this.emailTypeId,
            },
            this.initial
          );
        },
        preheaderChanged() {
          return this.hasPreheaderField
            ? this.preheader !== this.initialPreheader
            : false;
        },
        hasChanges() {
          return this.metadataChanged || this.preheaderChanged;
        },
        // Saving the preheader means saving the email: say so on the button
        // rather than surprising the user with it.
        saveLabel() {
          return this.preheaderChanged
            ? vm.t('email-metadata-save-with-email')
            : vm.t('email-metadata-save');
        },
        // Stored but not enforced in this phase: the company can declare fields
        // mandatory, and the panel marks them, but nothing blocks a save.
        isRequired() {
          const required = this.requiredFields;
          return {
            subject: required.indexOf('subject') !== -1,
            preheader: required.indexOf('preheader') !== -1,
            plannedSendDate: required.indexOf('plannedSendDate') !== -1,
            emailType: required.indexOf('emailType') !== -1,
          };
        },
      },

      watch: {
        // Straight through to the template's own property: this IS the save
        // mechanism for the preheader, the global save persists it.
        preheader(value) {
          const found = preheaderBinding();
          if (!found) return;
          this.feedback = null;
          // Angle brackets are stripped rather than escaped: this value is
          // interpolated as HTML by the template's own binding, and a preheader
          // has no legitimate use for markup.
          const clean = String(value || '')
            .replace(/[<>]/g, '')
            .slice(0, PREHEADER_HARD_LIMIT);
          if (clean !== value) this.preheader = clean;
          if (clean !== found.observable()) found.observable(clean);
        },
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
        t: (key) => vm.t(key),

        counterLabel(count) {
          return vm.t('email-metadata-counter', {
            length: count.length,
            min: count.min,
            max: count.max,
          });
        },

        async save() {
          if (this.isSaving) return;
          this.isSaving = true;
          this.feedback = null;

          const metadataChanged = this.metadataChanged;
          const preheaderChanged = this.preheaderChanged;
          const snapshot = {
            subject: this.subject,
            plannedSendDate: this.plannedSendDate,
            emailTypeId: this.emailTypeId,
          };

          try {
            const result = await runSave({
              metadataChanged,
              preheaderChanged,
              patch: () =>
                axios.patch(config.url.update, buildMetadataPayload(snapshot)),
              globalSave: () => vm.save && vm.save.execute && vm.save.execute(),
              canGlobalSave: () =>
                !vm.save || !vm.save.enabled || vm.save.enabled(),
            });

            if (result.savedMetadata) this.initial = snapshot;
            if (result.savedPreheader) this.initialPreheader = this.preheader;

            this.feedback = {
              type: 'success',
              key:
                result.outcome === OUTCOME.BOTH
                  ? 'email-metadata-saved-with-email'
                  : 'email-metadata-saved',
            };
          } catch (error) {
            // Whatever landed stays marked as saved, so the Save button remains
            // active for exactly what still needs saving.
            if (error.partial && error.partial.savedMetadata) {
              this.initial = snapshot;
            }
            this.feedback = { type: 'error', key: errorKeyFor(error) };
          } finally {
            this.isSaving = false;
          }
        },
      },

      template,
    });

    new Vue({ el: '#email-metadata-panel' });
  },
};

/**
 * A server error code mapped onto a translated message. A raw server message is
 * never shown: it is a code, or an untranslated developer sentence.
 *
 * @param {Error} error
 * @returns {string} an i18n key
 */
function errorKeyFor(error) {
  if (error && error.code === 'SAVE_IN_FLIGHT') {
    return 'email-metadata-error-busy';
  }

  const code =
    (error &&
      error.response &&
      error.response.data &&
      error.response.data.message) ||
    null;

  switch (code) {
    case 'EMAIL_METADATA_DISABLED':
      return 'email-metadata-error-disabled';
    case 'EMAIL_TYPE_NOT_FOUND':
      return 'email-metadata-error-typology';
    case 'EMAIL_TYPE_COMPANY_MISSING':
      return 'email-metadata-error-no-company';
    case 'INVALID_EMAIL_METADATA':
      return 'email-metadata-error-invalid';
    default:
      return 'email-metadata-error';
  }
}
