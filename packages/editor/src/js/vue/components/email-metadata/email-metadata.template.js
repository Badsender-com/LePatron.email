'use strict';

/**
 * Markup of the metadata group, kept out of the plugin so neither file grows past
 * what is comfortable to read.
 *
 * It renders as the second half of one continuous panel, under the template's own
 * options. Note what could NOT be done: the "Template Options" heading above is
 * not ours to rename — it is declared in each client template's markup, in its
 * `@supports -ko-blockdefs` block (6 of the 7 templates in the dev database say
 * "Template Options"; Ouest France has no such block at all). So the two headings
 * stay, styled alike and joined by a continuous frame, rather than merged into one.
 *
 * There is no save button. Metadata are written by the editor's Save, with the
 * rest of the email — see utils/email-metadata-store.js for why the two
 * frameworks talk through a store. A save button here would have created the
 * asymmetry it was meant to avoid: metadata persisting silently while the
 * template options beside them waited for the global Save.
 *
 * Every field is label-then-input with a real `for`/`id` pair, and its counter and
 * hint are tied to it with `aria-describedby` so a screen reader reads them as part
 * of the field rather than as loose text after it. The counter is deliberately NOT
 * `aria-live`: it changes on every keystroke, and announcing "12 chars · target
 * 30-50", "13 chars · target 30-50" over and over drowns out the typing. The state
 * is never colour-only — the numbers and the target are spelled out.
 *
 * "Does not appear in the email" is repeated per field rather than stated once at
 * the top. Since the group moved under the template's options, a statement in the
 * heading would sit above the preheader, the mirror link and the brand — which DO
 * appear in the email. True of these three fields, false of their neighbours.
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
           inbox, and the preheader stays in the template's own options (a product
           decision). Without this pointer nothing tells the user where it is. -->
      <p id="email-metadata-subject-hint" class="email-metadata__hint">
        {{ t('email-metadata-subject-hint') }}
        {{ t('email-metadata-preheader-note') }}
        {{ t('email-metadata-not-shown') }}
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
        {{ t('email-metadata-not-shown') }}
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
      <!-- Rendered unconditionally, unlike before: it now carries the "does not
           appear in the email" note, which is true whether or not the company has
           configured any type. -->
      <p id="email-metadata-typology-hint" class="email-metadata__hint">
        <template v-if="emailTypes.length === 0"
          >{{ t('email-metadata-typology-empty') }} </template
        >{{ t('email-metadata-not-shown') }}
      </p>
    </div>
  </section>
`;
