<script>
// The parent passes its `skill` data object directly so v-model can write
// straight back into it. The standard "no-mutating-props" rule would force
// boilerplate computed setters for every field, which has no functional
// benefit here — the parent owns the object lifecycle.
/* eslint-disable vue/no-mutating-props */
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';

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
  components: { BsTextField, BsSelect, BsTextarea },
  props: {
    skill: { type: Object, required: true },
    // Read-only schemas of the active version (schemas are versioned — §3).
    activeVersion: { type: Object, default: null },
    saving: { type: Boolean, default: false },
  },
  computed: {
    categoryOptions() {
      return CATEGORIES.map((value) => ({
        value,
        text: this.$t(`aiSkills.categories.${value}`),
      }));
    },
    inputSchemaId() {
      return (this.activeVersion && this.activeVersion.inputSchemaId) || '—';
    },
    outputSchemaId() {
      return (this.activeVersion && this.activeVersion.outputSchemaId) || '—';
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

    <div class="schemas-readonly mt-4">
      <div class="text-caption text--secondary">
        {{ $t('aiSkills.skill.inputSchemaId') }} ·
        {{ $t('aiSkills.skill.outputSchemaId') }}
      </div>
      <div class="d-flex" style="gap: 0.5rem">
        <v-chip small label outlined>
          {{ inputSchemaId }}
        </v-chip>
        <v-chip small label outlined>
          {{ outputSchemaId }}
        </v-chip>
      </div>
      <p class="text-caption text--secondary mt-1 mb-0">
        {{ $t('aiSkills.version.schemasHelp') }}
      </p>
    </div>

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
