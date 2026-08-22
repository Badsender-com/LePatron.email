/**
 * Markup of the metadata section, kept out of the plugin so neither file grows
 * past what is comfortable to read.
 *
 * A section of the Content tab, not a panel: same shape as Template Options and
 * the tracking section beside it — a title, then fields. It sits between the two,
 * so Template Options keeps the position users already know.
 *
 * Every field is label-then-input with a real `for`/`id` pair: clicking the label
 * focuses the field, and a screen reader announces its name. The counter shares
 * the label's line and is `aria-live`, so its state is not colour-only.
 *
 * No required markers. `requiredFields` is stored but nothing enforces it in this
 * phase, and an asterisk promising a check that does not exist is worse than no
 * asterisk at all.
 */
module.exports = `
  <section class="email-metadata" aria-labelledby="email-metadata-title">
    <h3 id="email-metadata-title" class="email-metadata__title">
      {{ t('email-metadata-title') }}
    </h3>
    <p class="email-metadata__intro">{{ t('email-metadata-intro') }}</p>

    <div class="email-metadata__field">
      <div class="email-metadata__labelRow">
        <label for="email-metadata-subject">{{ t('email-metadata-subject') }}</label>
        <span class="email-metadata__counter"
              :class="'email-metadata__counter--' + subjectCount.state"
              aria-live="polite">{{ counterLabel(subjectCount) }}</span>
      </div>
      <input id="email-metadata-subject"
             type="text"
             class="email-metadata__input"
             v-model="subject"
             :maxlength="subjectHardLimit"
             :placeholder="t('email-metadata-subject-placeholder')" />
      <p class="email-metadata__hint">{{ t('email-metadata-subject-hint') }}</p>
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__labelRow">
        <label for="email-metadata-date">{{ t('email-metadata-planned-date') }}</label>
      </div>
      <input id="email-metadata-date"
             type="date"
             class="email-metadata__input email-metadata__input--date"
             v-model="plannedSendDate" />
      <p class="email-metadata__hint">{{ t('email-metadata-planned-date-hint') }}</p>
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__labelRow">
        <label for="email-metadata-typology">{{ t('email-metadata-typology') }}</label>
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
       :class="'email-metadata__feedback--' + feedback.type"
       role="status"
       aria-live="polite">{{ t(feedback.key) }}</p>
  </section>
`;
