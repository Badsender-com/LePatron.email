<script>
import { Star } from 'lucide-vue';

/**
 * The default of a first-level dimension, starred on its value in the list
 * (ADR-0024, ADR-0026): the value a new email takes when its template gives
 * none. A star to click for whoever builds the taxonomy, a mark otherwise.
 * Emits `toggle`.
 */
export default {
  name: 'BsTaxonomyDefaultStar',
  components: { LucideStar: Star },
  props: {
    active: { type: Boolean, default: false },
    editable: { type: Boolean, default: false },
    label: { type: String, required: true },
  },
};
</script>

<template>
  <button
    v-if="editable"
    type="button"
    class="default-star"
    :class="{ 'default-star--on': active }"
    :aria-pressed="String(active)"
    :aria-label="$t('taxonomy.values.defaultStar', { label })"
    :title="$t('taxonomy.values.defaultStar', { label })"
    @click.stop="$emit('toggle')"
  >
    <lucide-star :size="16" />
  </button>
  <span
    v-else-if="active"
    class="default-star default-star--on"
    :title="$t('taxonomy.values.form.defaultChip')"
  >
    <lucide-star :size="16" />
  </span>
</template>

<style lang="scss" scoped>
.default-star {
  display: inline-flex;
  align-items: center;
  margin-right: 6px;
  padding: 2px;
  border: 0;
  background: none;
  color: var(--gray-500);
  vertical-align: middle;
  cursor: pointer;

  &--on {
    color: var(--v-accent-base);

    ::v-deep svg {
      fill: currentColor;
    }
  }

  &:focus-visible {
    outline: 2px solid var(--v-accent-base);
    border-radius: 4px;
  }
}

span.default-star {
  cursor: default;
}
</style>
