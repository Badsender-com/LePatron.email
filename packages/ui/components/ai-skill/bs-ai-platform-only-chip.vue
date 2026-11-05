<script>
// Marks a skill or an expertise that only the platform company uses (ADR
// 0013), so that opening it to all companies once proven is not forgotten.
// One with no audience yet is closed to the clients too, until the migration.
export default {
  name: 'BsAiPlatformOnlyChip',
  props: {
    audience: { type: String, default: null },
  },
};
</script>

<template>
  <v-chip
    v-if="audience !== 'all'"
    x-small
    outlined
    color="warning"
    class="ml-2"
  >
    {{ $t('aiSkills.platformOnly') }}
  </v-chip>
</template>
