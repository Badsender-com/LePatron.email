<script>
/**
 * BsAiSkillPicker — human-friendly skill selector: title as the main line,
 * truncated description as subtitle, category chip. The slug never shows in
 * the list (tooltip only) but stays searchable for power users. Reusable
 * outside the playground (admin screens, future features).
 */
import { skillCategoryLabel } from '~/helpers/ai-skill-categories.js';

export default {
  name: 'BsAiSkillPicker',
  props: {
    value: { type: String, default: null },
    skills: { type: Array, default: () => [] },
    label: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  methods: {
    categoryLabel(value) {
      return skillCategoryLabel(this, value);
    },
    // Only worth showing when it is NOT active: the list is active skills plus,
    // when an existing scenario references one, its archived skill.
    statusLabel(item) {
      if (!item.status || item.status === 'ACTIVE') return null;
      return this.$t(`aiSkills.statuses.${item.status}`);
    },
    truncate(text, max = 100) {
      if (!text) return '';
      return text.length > max ? `${text.slice(0, max)}…` : text;
    },
    // Search matches the human title AND the technical slug.
    filter(item, queryText) {
      const q = (queryText || '').toLowerCase();
      return (
        (item.title || '').toLowerCase().includes(q) ||
        (item.skillId || '').toLowerCase().includes(q)
      );
    },
  },
};
</script>

<template>
  <div class="bs-ai-skill-picker">
    <label v-if="label" class="bs-ai-skill-picker__label">{{ label }}</label>
    <v-autocomplete
      :value="value"
      :items="skills"
      item-text="title"
      item-value="skillId"
      :filter="filter"
      :disabled="disabled"
      solo
      flat
      outlined
      dense
      hide-details="auto"
      @input="$emit('input', $event)"
    >
      <template #item="{ item }">
        <v-list-item-content>
          <v-list-item-title :title="item.skillId">
            {{ item.title }}
          </v-list-item-title>
          <v-list-item-subtitle v-if="item.description">
            {{ truncate(item.description) }}
          </v-list-item-subtitle>
        </v-list-item-content>
        <v-list-item-action>
          <v-chip
            v-if="statusLabel(item)"
            x-small
            outlined
            color="warning"
            class="mr-1"
          >
            {{ statusLabel(item) }}
          </v-chip>
          <v-chip x-small outlined color="grey">
            {{ categoryLabel(item.category) }}
          </v-chip>
        </v-list-item-action>
      </template>
      <template #selection="{ item }">
        <span :title="item.skillId">{{ item.title }}</span>
        <v-chip
          v-if="statusLabel(item)"
          x-small
          outlined
          color="warning"
          class="ml-2"
        >
          {{ statusLabel(item) }}
        </v-chip>
      </template>
    </v-autocomplete>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-skill-picker {
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
