const Vue = require('vue/dist/vue.common');
const axios = require('axios');

const {
  subjectCounter,
  preheaderCounter,
  buildMetadataPayload,
  toFormState,
  typologyOptions,
  hasMetadataChanges,
  PREHEADER_HARD_LIMIT,
} = require('../utils/email-metadata');
const {
  findPreheaderObservable,
} = require('../utils/preheader-observable');

/**
 * The "Metadata" panel: subject, planned send date, typology, preheader.
 *
 * Two save mechanisms live side by side here, which is the whole subtlety.
 *
 * Subject, date and typology go through `PATCH /mailings/:id/metadata` when the
 * user clicks Save, with immediate feedback — they are mailing fields the global
 * save does not touch.
 *
 * The preheader is NOT patched. It is a template property: the editor holds the
 * template data in memory and rewrites it wholesale on the global save, so a
 * PATCH would be overwritten at the next save. The field therefore binds to the
 * SAME observable as the "Preheader" field of Template Options — no
 * synchronisation to write, the two cannot disagree — and the panel's Save also
 * triggers the global save when the preheader changed, so one click persists
 * everything the panel shows.
 *
 * All decisions (counters, date conversion, payload) live in
 * utils/email-metadata.js so they are testable: the editor has no component test
 * harness.
 *
 * The fields are styled by badsender-email-metadata.less rather than reusing
 * `bs-form-field`: that class is imported INSIDE badsender-modal.less, so it only
 * exists under a modal scope and reaches nothing here.
 */
module.exports = {
  viewModel(vm, ko) {
    // Presence of the config is what decides the panel exists. An opted-out
    // company gets neither key from findOneForMosaico, so there is nothing to
    // toggle and the button never renders.
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    vm.hasEmailMetadata = ko.observable(Boolean(config && config.enabled));
    vm.showMetadata = ko.observable(false);
  },

  init(vm) {
    const config = (vm.metadata && vm.metadata.emailMetadataConfig) || null;
    if (!config || !config.enabled) return;

    const values = (vm.metadata && vm.metadata.emailMetadata) || {};
    const initialForm = toFormState(values);

    // Located once, at init: the template's shape does not change while the
    // editor is open. `null` means the template declares no preheader — the field
    // is then disabled rather than inventing a property the template never had.
    const preheaderBinding = findPreheaderObservable(vm.content);

    Vue.component('EmailMetadataPlugin', {
      data: () => ({
        subject: initialForm.subject,
        plannedSendDate: initialForm.plannedSendDate,
        emailTypeId: initialForm.emailTypeId,
        initial: { ...initialForm },
        preheader: preheaderBinding ? preheaderBinding.observable() || '' : '',
        initialPreheader: preheaderBinding
          ? preheaderBinding.observable() || ''
          : '',
        hasPreheaderField: Boolean(preheaderBinding),
        emailTypes: config.emailTypes || [],
        requiredFields: config.requiredFields || [],
        isSaving: false,
        feedback: null,
        preheaderSubscription: null,
      }),

      mounted() {
        // Template Options and this panel write to the same observable, so a
        // change made there must show here without the user reopening the panel.
        if (preheaderBinding) {
          this.preheaderSubscription = preheaderBinding.observable.subscribe(
            (value) => {
              const next = typeof value === 'string' ? value : '';
              if (next !== this.preheader) this.preheader = next;
            }
          );
        }
      },

      beforeDestroy() {
        if (this.preheaderSubscription) this.preheaderSubscription.dispose();
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
            vm.t('email-metadata-typology-none')
          );
        },
        hasChanges() {
          return (
            hasMetadataChanges(
              {
                subject: this.subject,
                plannedSendDate: this.plannedSendDate,
                emailTypeId: this.emailTypeId,
              },
              this.initial
            ) || this.preheaderChanged
          );
        },
        preheaderChanged() {
          return this.hasPreheaderField
            ? this.preheader !== this.initialPreheader
            : false;
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
          if (!preheaderBinding) return;
          const capped = String(value || '').slice(0, PREHEADER_HARD_LIMIT);
          if (capped !== preheaderBinding.observable()) {
            preheaderBinding.observable(capped);
          }
        },
      },

      methods: {
        t: (key) => vm.t(key),

        close() {
          vm.showMetadata(false);
        },

        async save() {
          if (this.isSaving) return;
          this.isSaving = true;
          this.feedback = null;

          const needsGlobalSave = this.preheaderChanged;

          try {
            const payload = buildMetadataPayload({
              subject: this.subject,
              plannedSendDate: this.plannedSendDate,
              emailTypeId: this.emailTypeId,
            });
            await axios.patch(config.url.update, payload);

            this.initial = {
              subject: this.subject,
              plannedSendDate: this.plannedSendDate,
              emailTypeId: this.emailTypeId,
            };

            // The preheader lives in the template data; only the global save
            // writes it. Triggered here so one click persists everything the
            // panel shows — and only when it actually changed, since the global
            // save also re-exports the HTML.
            if (needsGlobalSave && vm.save && vm.save.execute) {
              vm.save.execute();
              this.initialPreheader = this.preheader;
            }

            this.feedback = { type: 'success', key: 'email-metadata-saved' };
            vm.notifier.success(vm.t('email-metadata-saved'));
          } catch (error) {
            const code =
              (error.response &&
                error.response.data &&
                error.response.data.message) ||
              null;
            const key =
              code === 'EMAIL_METADATA_DISABLED'
                ? 'email-metadata-error-disabled'
                : code === 'EMAIL_TYPE_NOT_FOUND'
                ? 'email-metadata-error-typology'
                : 'email-metadata-error';
            this.feedback = { type: 'error', key };
            vm.notifier.error(vm.t(key));
          } finally {
            this.isSaving = false;
          }
        },
      },

      template: `
        <div class="email-metadata">
          <p class="email-metadata__intro">{{ t('email-metadata-intro') }}</p>

          <div class="email-metadata__field">
            <div class="email-metadata__labelRow">
              <label for="email-metadata-subject">
                {{ t('email-metadata-subject') }}
                <span v-if="isRequired.subject" class="email-metadata__required">*</span>
              </label>
              <span class="email-metadata__counter"
                    :class="'email-metadata__counter--' + subjectCount.state">
                {{ subjectCount.length }} / {{ subjectCount.min }}–{{ subjectCount.max }}
              </span>
            </div>
            <input id="email-metadata-subject"
                   type="text"
                   class="email-metadata__input"
                   v-model="subject"
                   :placeholder="t('email-metadata-subject-placeholder')" />
            <p class="email-metadata__hint">{{ t('email-metadata-subject-hint') }}</p>
          </div>

          <div class="email-metadata__field">
            <div class="email-metadata__labelRow">
              <label for="email-metadata-preheader">
                {{ t('email-metadata-preheader') }}
                <span v-if="isRequired.preheader" class="email-metadata__required">*</span>
              </label>
              <span v-if="hasPreheaderField"
                    class="email-metadata__counter"
                    :class="'email-metadata__counter--' + preheaderCount.state">
                {{ preheaderCount.length }} / {{ preheaderCount.min }}–{{ preheaderCount.max }}
              </span>
            </div>
            <input id="email-metadata-preheader"
                   type="text"
                   class="email-metadata__input"
                   v-model="preheader"
                   :disabled="!hasPreheaderField"
                   :placeholder="t('email-metadata-preheader-placeholder')" />
            <p class="email-metadata__hint">
              <template v-if="hasPreheaderField">{{ t('email-metadata-preheader-hint') }}</template>
              <template v-else>{{ t('email-metadata-preheader-unavailable') }}</template>
            </p>
          </div>

          <div class="email-metadata__field">
            <div class="email-metadata__labelRow">
              <label for="email-metadata-date">
                {{ t('email-metadata-planned-date') }}
                <span v-if="isRequired.plannedSendDate" class="email-metadata__required">*</span>
              </label>
            </div>
            <input id="email-metadata-date"
                   type="date"
                   class="email-metadata__input email-metadata__input--date"
                   v-model="plannedSendDate" />
            <p class="email-metadata__hint">{{ t('email-metadata-planned-date-hint') }}</p>
          </div>

          <div class="email-metadata__field">
            <div class="email-metadata__labelRow">
              <label for="email-metadata-typology">
                {{ t('email-metadata-typology') }}
                <span v-if="isRequired.emailType" class="email-metadata__required">*</span>
              </label>
            </div>
            <select id="email-metadata-typology"
                    class="email-metadata__select"
                    v-model="emailTypeId">
              <option v-for="choice in typologyChoices"
                      :key="choice.value"
                      :value="choice.value">{{ choice.text }}</option>
            </select>
            <p v-if="emailTypes.length === 0" class="email-metadata__hint">
              {{ t('email-metadata-typology-empty') }}
            </p>
          </div>

          <div class="email-metadata__actions">
            <button type="button"
                    class="email-metadata__save"
                    :disabled="isSaving || !hasChanges"
                    @click="save">
              {{ isSaving ? t('email-metadata-saving') : t('email-metadata-save') }}
            </button>
          </div>

          <p v-if="feedback"
             class="email-metadata__feedback"
             :class="'email-metadata__feedback--' + feedback.type">
            {{ t(feedback.key) }}
          </p>
        </div>
      `,
    });

    new Vue({ el: '#email-metadata-panel' });
  },
};
