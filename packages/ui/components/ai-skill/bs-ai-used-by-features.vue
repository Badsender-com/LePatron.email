<script>
// The features that use a skill or an expertise, on its detail page. Worked
// out by the server from the features' declarations (ADR 0019).
export default {
  name: 'BsAiUsedByFeatures',
  props: {
    usedBy: { type: Array, default: () => [] },
  },
};
</script>

<template>
  <div class="used-by-features text-caption">
    <template v-if="usedBy.length">
      <span class="text--secondary">
        {{ $t('aiSkills.usedByFeature.features') }}
      </span>
      <v-chip
        v-for="feature in usedBy"
        :key="feature.featureType"
        x-small
        outlined
        color="primary"
        class="ml-2"
        :title="feature.featureType"
      >
        {{ feature.description }}
      </v-chip>
    </template>
    <span v-else class="text--disabled">
      {{ $t('aiSkills.usedByFeature.none') }}
    </span>
    <span class="text--disabled ml-2">
      {{ $t('aiSkills.usedByFeature.hint') }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.used-by-features {
  padding: 0.25rem 1.5rem 0;
}
</style>
