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
 * Labelled fields in a panel titled "Email settings" do not need a paragraph
 * each. `maxlength` still mirrors the server's hard limit, which is a rule rather
 * than advice.
 *
 * Two hints, and neither is a paragraph of instructions. When the company has
 * configured no email type, the select is empty and disabled and nothing on screen
 * says what to do about it: that one says where to create them. Otherwise the
 * selected typology's own definition is shown — the company's words, not ours,
 * changing with the choice rather than sitting there permanently. The trigger needs
 * no hint: its two definitions are short enough to live inside the options.
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
              :aria-describedby="typologyHintId">
        <!-- The title attribute puts the definition within reach while the list
             is open. NOTE: no backtick may appear anywhere in this markup — it is
             a template literal, and one would end it. Covered by
             tests/editor/email-metadata-template.test.js, which exists because
             that happened. The attribute is a hover affordance and nothing
             depends on it: the same text is rendered below for whichever option
             is selected. -->
        <option v-for="choice in typologyChoices"
                :key="choice.value"
                :value="choice.value"
                :title="choice.description || null">{{ choice.text }}</option>
      </select>
      <!-- Two hints, never both: with no type configured the select is empty AND
           disabled and says where to create them; otherwise it shows the
           company's own definition of what they just picked. -->
      <p v-if="emailTypes.length === 0"
         id="email-metadata-typology-hint"
         class="email-metadata__hint">
        {{ t('email-metadata-typology-empty') }}
      </p>
      <p v-else-if="typologyDescription"
         id="email-metadata-typology-hint"
         class="email-metadata__hint">
        {{ typologyDescription }}
      </p>
    </div>

    <!-- The second classification dimension, independent of the type: is there a
         human decision for THIS send? Never disabled, unlike the typology — its
         two values are the doctrine's, not the company's, so there is no state in
         which none is configured. -->
    <div class="email-metadata__field">
      <div class="email-metadata__label-row">
        <label for="email-metadata-trigger">{{ t('email-metadata-trigger') }}</label>
      </div>
      <select id="email-metadata-trigger"
              class="email-metadata__select"
              v-model="trigger">
        <option v-for="choice in triggerChoices"
                :key="choice.value"
                :value="choice.value">{{ choice.text }}</option>
      </select>
    </div>
  </section>
`;
