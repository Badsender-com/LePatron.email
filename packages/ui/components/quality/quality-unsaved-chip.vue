<script>
// What the quality pages put on a change not saved yet: a card, a row of the
// table of every check.
export default {
  name: 'BsQualityUnsavedChip',
  props: {
    label: { type: String, required: true },
  },
};
</script>

<template>
  <v-chip x-small class="qx-unsaved">
    <span class="qx-unsaved__dot" />
    {{ label }}
  </v-chip>
</template>

<style lang="scss" scoped>
.qx-unsaved {
  background: rgba(255, 180, 0, 0.2) !important;
  color: var(--gray-900) !important;
  font-weight: 600;

  &__dot {
    width: 6px;
    height: 6px;
    margin-right: 5px;
    border-radius: 50%;
    background: var(--v-warning-base);
  }
}
</style>
