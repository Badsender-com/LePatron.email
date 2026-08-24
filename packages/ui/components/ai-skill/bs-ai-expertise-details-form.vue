<script>
// The page owns the expertise object; this form never writes into it. See
// bs-ai-skill-details-form for the rationale.
import * as api from '~/helpers/ai-skill-routes.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsAiLanguagePicker from '~/components/ai-skill/bs-ai-language-picker.vue';
import { emailTypeItems, emailTypeLabel } from '~/helpers/email-types.js';
import { skillCategoryOptions } from '~/helpers/ai-skill-categories.js';

export default {
  name: 'BsAiExpertiseDetailsForm',
  components: {
    BsTextField,
    BsSelect,
    BsTextarea,
    BsCombobox,
    BsAiLanguagePicker,
  },
  props: {
    value: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  data() {
    return { scopeFacets: [], emailTypeFacets: [] };
  },
  computed: {
    categoryOptions() {
      return skillCategoryOptions(this);
    },
    emailTypeItems() {
      return emailTypeItems(this.emailTypeFacets);
    },
  },
  async mounted() {
    try {
      const res = await this.$axios.$get(api.aiExpertiseFacets());
      this.scopeFacets = res.scopes || [];
      this.emailTypeFacets = res.emailTypes || [];
    } catch (err) {
      this.scopeFacets = [];
      this.emailTypeFacets = [];
    }
  },
  methods: {
    update(patch) {
      this.$emit('input', { ...this.value, ...patch });
    },
    emailTypeLabel(value) {
      return emailTypeLabel(this, value);
    },
    onTransversalChange(checked) {
      // Scope and transversal are contradictory; the flag wins. Clear the
      // scope so the saved state matches what the disabled field shows.
      this.update(
        checked ? { isTransversal: true, scope: [] } : { isTransversal: false }
      );
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <bs-text-field
      :value="value.title"
      :label="$t('global.title')"
      @input="update({ title: $event })"
    />
    <bs-textarea
      :value="value.description"
      :label="$t('global.description')"
      :hint="$t('aiSkills.expertise.descriptionHelp')"
      persistent-hint
      :rows="2"
      @input="update({ description: $event })"
    />
    <bs-select
      :value="value.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
      :hint="$t('aiSkills.expertise.categoryHelp')"
      persistent-hint
      @input="update({ category: $event })"
    />
    <v-checkbox
      :input-value="value.isTransversal"
      :label="$t('aiSkills.expertise.transversal')"
      :hint="$t('aiSkills.expertise.transversalHint')"
      persistent-hint
      dense
      class="mt-2"
      @change="onTransversalChange"
    />
    <bs-combobox
      :value="value.scope"
      :items="scopeFacets"
      :label="$t('aiSkills.expertise.scope')"
      :hint="$t('aiSkills.expertise.scopeHelp')"
      persistent-hint
      :disabled="value.isTransversal"
      multiple
      chips
      small-chips
      clearable
      @input="update({ scope: $event })"
    />
    <bs-combobox
      :value="value.appliesToEmailTypes"
      :items="emailTypeItems"
      :label="$t('aiSkills.expertise.appliesToEmailTypes')"
      :hint="$t('aiSkills.expertise.emailTypeHelp')"
      persistent-hint
      multiple
      chips
      small-chips
      clearable
      @input="update({ appliesToEmailTypes: $event })"
    >
      <template #selection="{ item }">
        <v-chip small>
          {{ emailTypeLabel(item) }}
        </v-chip>
      </template>
      <template #item="{ item }">
        {{ emailTypeLabel(item) }}
      </template>
    </bs-combobox>
    <bs-ai-language-picker
      :value="value.appliesToLanguages"
      :label="$t('aiSkills.expertise.appliesToLanguages')"
      :hint="$t('aiSkills.expertise.languageHelp')"
      @input="update({ appliesToLanguages: $event })"
    />
    <div class="d-flex justify-end mt-3">
      <v-btn
        color="accent"
        elevation="0"
        :loading="saving"
        @click="$emit('save')"
      >
        {{ $t('global.save') }}
      </v-btn>
    </div>
  </v-card>
</template>
