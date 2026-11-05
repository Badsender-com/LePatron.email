<script>
// Opening a task skill to every company (ADR 0013): the expertises its
// version consumes that are kept to the platform company, each of which may
// be opened with it. None is checked at first: opening an expertise applies
// it to the editor's features of every company too, at once, which is a
// choice of its own. With none checked, the skill opens without them.
import { toggled } from '~/helpers/ai-skill-audience-change.js';

export default {
  name: 'BsAiOpenExpertisesChoice',
  props: {
    // [{ expertiseId, title }]
    expertises: { type: Array, default: () => [] },
    // The expertise ids checked.
    value: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
  },
  methods: {
    isChecked(expertiseId) {
      return this.value.includes(expertiseId);
    },
    toggle(expertiseId, checked) {
      this.$emit('input', toggled(this.value, expertiseId, checked === true));
    },
  },
};
</script>

<template>
  <v-alert
    v-if="expertises.length"
    type="warning"
    dense
    outlined
    class="mt-3 mb-0 text-caption"
  >
    <div>{{ $t('aiSkills.openExpertises.intro') }}</div>
    <div
      v-for="expertise in expertises"
      :key="expertise.expertiseId"
      class="open-expertise mt-2"
    >
      <div class="font-weight-medium text--primary">
        {{ expertise.title }}
        <code>{{ expertise.expertiseId }}</code>
      </div>
      <v-checkbox
        :input-value="isChecked(expertise.expertiseId)"
        :label="$t('aiSkills.openExpertises.openToo')"
        :disabled="disabled"
        dense
        hide-details
        class="mt-0"
        @change="toggle(expertise.expertiseId, $event)"
      />
    </div>
    <div class="mt-2">{{ $t('aiSkills.openExpertises.appliesAtOnce') }}</div>
  </v-alert>
</template>

<style lang="scss" scoped>
.open-expertise code {
  font-size: 0.72rem;
  background: none;
  padding: 0;
}
</style>
