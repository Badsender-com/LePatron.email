'use strict';

/**
 * Markup of the metadata section, kept out of the plugin so neither file grows
 * past what is comfortable to read.
 *
 * A section of the Content tab, not a panel: same shape as Template Options and
 * the tracking section beside it — a title, then fields.
 *
 * Every field is label-then-input with a real `for`/`id` pair, and its counter and
 * hint are tied to it with `aria-describedby` so a screen reader reads them as part
 * of the field rather than as loose text after it. The counter is deliberately NOT
 * `aria-live`: it changes on every keystroke, and announcing "12 chars · target
 * 30-50", "13 chars · target 30-50" over and over drowns out the typing. The state
 * is never colour-only — the numbers and the target are spelled out.
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
      <div class="email-metadata__label-row">
        <label for="email-metadata-subject">{{ t('email-metadata-subject') }}</label>
        <span id="email-metadata-subject-counter"
              class="email-metadata__counter"
              :class="'email-metadata__counter--' + subjectCount.state"
              >{{ counterLabel(subjectCount) }}</span>
      </div>
      <input id="email-metadata-subject"
             type="text"
             class="email-metadata__input"
             v-model="subject"
             :maxlength="subjectHardLimit"
             aria-describedby="email-metadata-subject-counter email-metadata-subject-hint"
             :placeholder="t('email-metadata-subject-placeholder')" />
      <!-- Subject and preheader are the two strings the recipient reads in their
           inbox, and the preheader stays in Template Options (a product decision).
           Without this pointer nothing tells the user where it went. -->
      <p id="email-metadata-subject-hint" class="email-metadata__hint">
        {{ t('email-metadata-subject-hint') }}
        {{ t('email-metadata-preheader-note') }}
      </p>
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__label-row">
        <label for="email-metadata-date">{{ t('email-metadata-planned-date') }}</label>
      </div>
      <input id="email-metadata-date"
             type="date"
             class="email-metadata__input email-metadata__input--date"
             v-model="plannedSendDate"
             aria-describedby="email-metadata-date-hint" />
      <p id="email-metadata-date-hint" class="email-metadata__hint">
        {{ t('email-metadata-planned-date-hint') }}
      </p>
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__label-row">
        <label for="email-metadata-typology">{{ t('email-metadata-typology') }}</label>
      </div>
      <select id="email-metadata-typology"
              class="email-metadata__select"
              v-model="emailTypeId"
              :disabled="emailTypes.length === 0"
              aria-describedby="email-metadata-typology-hint">
        <option v-for="choice in typologyChoices"
                :key="choice.value"
                :value="choice.value">{{ choice.text }}</option>
      </select>
      <p v-if="emailTypes.length === 0"
         id="email-metadata-typology-hint"
         class="email-metadata__hint">
        {{ t('email-metadata-typology-empty') }}
      </p>
    </div>

    <div class="email-metadata__actions">
      <p v-if="feedback"
         class="email-metadata__feedback"
         :class="'email-metadata__feedback--' + feedback.type"
         role="status">{{ t(feedback.key) }}</p>
      <button type="button"
              class="email-metadata__save"
              :disabled="isSaving || !hasChanges"
              @click="save">
        {{ isSaving ? t('email-metadata-saving') : t('email-metadata-save') }}
      </button>
    </div>
  </section>
`;
