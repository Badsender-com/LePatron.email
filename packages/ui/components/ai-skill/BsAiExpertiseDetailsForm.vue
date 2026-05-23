<script>
// Parent owns the expertise object and accepts in-place edits via v-model;
// see BsAiSkillDetailsForm for rationale.
/* eslint-disable vue/no-mutating-props */
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import BsCombobox from '~/components/form/bs-combobox.vue';

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
  components: { BsTextField, BsSelect, BsTextarea, BsCombobox },
  props: {
    expertise: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
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
      :rows="2"
    />
    <bs-select
      v-model="expertise.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
    />
    <bs-combobox
      v-model="expertise.scope"
      :label="$t('aiSkills.expertise.scope')"
      multiple
      chips
      small-chips
    />
    <bs-combobox
      v-model="expertise.appliesToEmailTypes"
      :label="$t('aiSkills.expertise.appliesToEmailTypes')"
      multiple
      chips
      small-chips
    />
    <bs-combobox
      v-model="expertise.appliesToLanguages"
      :label="$t('aiSkills.expertise.appliesToLanguages')"
      multiple
      chips
      small-chips
    />
    <bs-combobox
      v-model="expertise.consumedBySkills"
      :label="$t('aiSkills.expertise.consumedBySkills')"
      multiple
      chips
      small-chips
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
