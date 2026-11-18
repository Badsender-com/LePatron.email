<script>
// The switch in the header of an AI feature's section: its state in a word,
// then the switch. The same for every feature of the page, so that each one
// reads and turns on the same way.
export default {
  name: 'BsGroupFeatureSwitch',
  model: { prop: 'value', event: 'change' },
  props: {
    value: { type: Boolean, default: false },
    // The feature's name, the switch's accessible label.
    label: { type: String, required: true },
    onText: { type: String, required: true },
    offText: { type: String, required: true },
    loading: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
};
</script>

<template>
  <div class="bs-group-feature-switch">
    <span
      class="bs-group-feature-switch__state"
      :class="{ 'bs-group-feature-switch__state--on': value }"
      aria-hidden="true"
    >
      {{ value ? onText : offText }}
    </span>
    <v-switch
      :input-value="value"
      :aria-label="label"
      :loading="loading"
      :disabled="disabled"
      color="accent"
      hide-details
      class="mt-0 pt-0"
      @change="$emit('change', $event)"
    />
  </div>
</template>

<style lang="scss" scoped>
.bs-group-feature-switch {
  display: flex;
  align-items: center;
  gap: 0.5rem;

  &__state {
    font-size: 0.8125rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);

    &--on {
      color: var(--v-success-darken1);
    }
  }
}
</style>
