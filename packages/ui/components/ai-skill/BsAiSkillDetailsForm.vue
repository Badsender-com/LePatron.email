<script>
// The parent passes its `skill` data object directly so v-model can write
// straight back into it. The standard "no-mutating-props" rule would force
// boilerplate computed setters for every field, which has no functional
// benefit here — the parent owns the object lifecycle.
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
  name: 'BsAiSkillDetailsForm',
  components: { BsTextField, BsSelect, BsTextarea, BsCombobox },
  props: {
    skill: { type: Object, required: true },
    schemas: { type: Array, default: () => [] },
    saving: { type: Boolean, default: false },
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    inputSchemas() {
      return this.schemas.filter((s) => /Input$/.test(s));
    },
    outputSchemas() {
      return this.schemas.filter((s) => /Output$/.test(s));
    },
  },
};
</script>

<template>
  <v-card outlined class="pa-4">
    <bs-text-field v-model="skill.title" :label="$t('global.title')" />
    <bs-textarea
      v-model="skill.description"
      :label="$t('global.description')"
      :rows="2"
    />
    <bs-select
      v-model="skill.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
    />
    <bs-select
      v-model="skill.inputSchemaId"
      :items="inputSchemas"
      :label="$t('aiSkills.skill.inputSchemaId')"
    />
    <bs-select
      v-model="skill.outputSchemaId"
      :items="outputSchemas"
      :label="$t('aiSkills.skill.outputSchemaId')"
    />
    <bs-combobox
      v-model="skill.intendedUseCases"
      :label="$t('aiSkills.skill.intendedUseCases')"
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
