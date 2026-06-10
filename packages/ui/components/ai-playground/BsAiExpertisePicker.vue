<script>
/**
 * BsAiExpertisePicker — human-friendly expertise selector (multiple): title,
 * truncated description, category chip and scope chips. When `skillCategory`
 * is set, expertise of the same category is listed first under a
 * "Recommended for this skill" header (sorting only — nothing is hidden).
 * The slug stays searchable but is only shown as a tooltip.
 */
export default {
  name: 'BsAiExpertisePicker',
  props: {
    value: { type: Array, default: () => [] },
    expertise: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    skillCategory: { type: String, default: null },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    items() {
      if (!this.skillCategory) return this.expertise;
      const recommended = this.expertise.filter(
        (e) => e.category === this.skillCategory
      );
      const others = this.expertise.filter(
        (e) => e.category !== this.skillCategory
      );
      if (!recommended.length) return this.expertise;
      return [
        { header: this.$t('aiPlayground.form.expertiseRecommended') },
        ...recommended,
        { header: this.$t('aiPlayground.form.expertiseAll') },
        ...others,
      ];
    },
  },
  methods: {
    categoryLabel(value) {
      return value ? this.$t(`aiSkills.categories.${value}`) : '';
    },
    truncate(text, max = 100) {
      if (!text) return '';
      return text.length > max ? `${text.slice(0, max)}…` : text;
    },
    filter(item, queryText) {
      if (item.header) return false;
      const q = (queryText || '').toLowerCase();
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.expertiseId || '').toLowerCase().includes(q)
      );
    },
  },
};
</script>

<template>
  <div class="bs-ai-expertise-picker">
    <label v-if="label" class="bs-ai-expertise-picker__label">
      {{ label }}
    </label>
    <v-autocomplete
      :value="value"
      :items="items"
      item-text="title"
      item-value="expertiseId"
      :filter="filter"
      :disabled="disabled"
      multiple
      chips
      small-chips
      deletable-chips
      solo
      flat
      outlined
      dense
      hide-details="auto"
      @input="$emit('input', $event)"
    >
      <template #item="{ item }">
        <v-list-item-content>
          <v-list-item-title :title="item.expertiseId">
            {{ item.title }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="item.description">
            {{ truncate(item.description) }}
          </v-list-item-subtitle>
          <div v-if="item.scope && item.scope.length" class="mt-1">
            <v-chip
              v-for="s in item.scope"
              :key="s"
              x-small
              outlined
              class="mr-1"
            >
              {{ s }}
            </v-chip>
          </div>
        </v-list-item-content>
        <v-list-item-action>
          <v-chip x-small outlined color="grey">
            {{ categoryLabel(item.category) }}
          </v-chip>
        </v-list-item-action>
      </template>
    </v-autocomplete>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-expertise-picker {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }
}
</style>
