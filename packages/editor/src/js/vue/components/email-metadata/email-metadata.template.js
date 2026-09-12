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
 * Every field is label-then-input with a real `for`/`id` pair.
 *
 * No explanatory sentence under any field, and no character counter on the
 * subject: all removed on request, to be reconsidered only if users ask for them.
 * Three labelled fields in a panel titled "Email settings" do not need a paragraph
 * each. `maxlength` still mirrors the server's hard limit, which is a rule rather
 * than advice.
 *
 * One hint survives, and it is not an explanation: when the company has configured
 * no email type, the select is empty and disabled, and nothing on screen says what
 * to do about it. That one says where to create them.
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
      </div>
      <input id="email-metadata-subject"
             type="text"
             class="email-metadata__input"
             v-model="subject"
             :maxlength="subjectHardLimit"
             :placeholder="t('email-metadata-subject-placeholder')" />
    </div>

    <div class="email-metadata__field">
      <div class="email-metadata__label-row">
        <label for="email-metadata-date">{{ t('email-metadata-planned-date') }}</label>
      </div>
      <input id="email-metadata-date"
             type="date"
             class="email-metadata__input email-metadata__input--date"
             v-model="plannedSendDate" />
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
      <!-- The one surviving hint, and not an explanation: with no type configured
           the select is empty AND disabled, which tells the user nothing about
           what to do. It says where to create them. -->
      <p v-if="emailTypes.length === 0"
         id="email-metadata-typology-hint"
         class="email-metadata__hint">
        {{ t('email-metadata-typology-empty') }}
      </p>
    </div>
  </section>
`;
