<script>
// The page owns the skill object; this form never writes into it. Every field
// emits `input` with a fresh object (v-model on the component), so the flow of
// state stays one-directional and the page is the single writer.
import BsTextField from '~/components/form/bs-text-field.vue';
import BsSelect from '~/components/form/bs-select.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';
import { skillCategoryOptions } from '~/helpers/ai-skill-categories.js';

export default {
  name: 'BsAiSkillDetailsForm',
  components: { BsTextField, BsSelect, BsTextarea },
  props: {
    value: { type: Object, required: true },
    saving: { type: Boolean, default: false },
  },
  computed: {
    categoryOptions() {
      return skillCategoryOptions(this);
    },
  },
  methods: {
    update(patch) {
      this.$emit('input', { ...this.value, ...patch });
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
      :rows="2"
      @input="update({ description: $event })"
    />
    <bs-select
      :value="value.category"
      :items="categoryOptions"
      item-text="text"
      item-value="value"
      :label="$t('aiSkills.filters.category')"
      @input="update({ category: $event })"
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
