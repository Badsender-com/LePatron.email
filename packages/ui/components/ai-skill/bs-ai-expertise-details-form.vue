<script>
// Parent owns the expertise object and accepts in-place edits via v-model;
// see BsAiSkillDetailsForm for rationale.
/* eslint-disable vue/no-mutating-props */
import * as api from '~/helpers/ai-skill-routes.js';
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';
import BsAiLanguagePicker from '~/components/ai-skill/bs-ai-language-picker.vue';
import { emailTypeItems, emailTypeLabel } from '~/helpers/email-types.js';

const CATEGORIES = [
  'redaction',
  'qc',
  'design',
  'html_integration',
  'deliverability',
  'translation',
  'other',
];

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
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  data() {
    return { scopeFacets: [], emailTypeFacets: [] };
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
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
    emailTypeLabel(value) {
      return emailTypeLabel(this, value);
    },
    onTransversalChange(checked) {
      // Scope and transversal are contradictory; the flag wins. Clear the
      // scope so the saved state matches what the disabled field shows.
      if (checked) this.expertise.scope = [];
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <bs-text-field v-model="expertise.title" :label="$t('global.title')" />
    <bs-textarea
      v-model="expertise.description"
      :label="$t('global.description')"
      :hint="$t('aiSkills.expertise.descriptionHelp')"
      persistent-hint
      :rows="2"
    />
    <bs-select
      v-model="expertise.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
      :hint="$t('aiSkills.expertise.categoryHelp')"
      persistent-hint
    />
    <v-checkbox
      v-model="expertise.isTransversal"
      :label="$t('aiSkills.expertise.transversal')"
      :hint="$t('aiSkills.expertise.transversalHint')"
      persistent-hint
      dense
      class="mt-2"
      @change="onTransversalChange"
    />
    <bs-combobox
      v-model="expertise.scope"
      :items="scopeFacets"
      :label="$t('aiSkills.expertise.scope')"
      :hint="$t('aiSkills.expertise.scopeHelp')"
      persistent-hint
      :disabled="expertise.isTransversal"
      multiple
      chips
      small-chips
    />
    <bs-combobox
      v-model="expertise.appliesToEmailTypes"
      :items="emailTypeItems"
      :label="$t('aiSkills.expertise.appliesToEmailTypes')"
      :hint="$t('aiSkills.expertise.emailTypeHelp')"
      persistent-hint
      multiple
      chips
      small-chips
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
      :value="expertise.appliesToLanguages"
      :label="$t('aiSkills.expertise.appliesToLanguages')"
      :hint="$t('aiSkills.expertise.languageHelp')"
      @input="expertise.appliesToLanguages = $event"
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
