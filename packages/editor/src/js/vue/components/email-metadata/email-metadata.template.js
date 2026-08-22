/**
 * Markup of the metadata panel, kept out of the plugin so neither file grows past
 * what is comfortable to read.
 *
 * Every field is label-then-input with a real `for`/`id` pair: clicking the label
 * focuses the field, and a screen reader announces its name. The counter shares
 * the label's line and is `aria-live` so its state is not colour-only.
 */
module.exports = `
  <div class="email-metadata">
    <p class="email-metadata__intro">{{ t('email-metadata-intro') }}</p>

    <div class="email-metadata__field">
      <div class="email-metadata__labelRow">
        <label for="email-metadata-subject">
          {{ t('email-metadata-subject') }}
          <span v-if="isRequired.subject"
                class="email-metadata__required"
                :title="t('email-metadata-required')">*</span>
        </label>
        <span class="email-metadata__counter"
              :class="'email-metadata__counter--' + subjectCount.state"
              aria-live="polite">{{ counterLabel(subjectCount) }}</span>
      </div>
      <input id="email-metadata-subject"
             type="text"
             class="email-metadata__input"
             v-model="subject"
             :maxlength="subjectHardLimit"
             :aria-required="isRequired.subject ? 'true' : null"
             :placeholder="t('email-metadata-subject-placeholder')" />
      <p class="email-metadata__hint">{{ t('email-metadata-subject-hint') }}</p>
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__labelRow">
        <label for="email-metadata-preheader">
          {{ t('email-metadata-preheader') }}
          <span v-if="isRequired.preheader"
                class="email-metadata__required"
                :title="t('email-metadata-required')">*</span>
        </label>
        <span v-if="hasPreheaderField"
              class="email-metadata__counter"
              :class="'email-metadata__counter--' + preheaderCount.state"
              aria-live="polite">{{ counterLabel(preheaderCount) }}</span>
      </div>
      <input id="email-metadata-preheader"
             type="text"
             class="email-metadata__input"
             v-model="preheader"
             :maxlength="preheaderHardLimit"
             :disabled="!hasPreheaderField"
             :aria-required="isRequired.preheader ? 'true' : null"
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
          <span v-if="isRequired.plannedSendDate"
                class="email-metadata__required"
                :title="t('email-metadata-required')">*</span>
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
          <span v-if="isRequired.emailType"
                class="email-metadata__required"
                :title="t('email-metadata-required')">*</span>
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
        {{ isSaving ? t('email-metadata-saving') : saveLabel }}
      </button>
    </div>

    <p v-if="feedback"
       class="email-metadata__feedback"
       :class="'email-metadata__feedback--' + feedback.type"
       role="status"
       aria-live="polite">{{ t(feedback.key) }}</p>
  </div>
`;
