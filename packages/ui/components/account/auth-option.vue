<script>
// An option to tick in the sign-in card, framed like the consent's: accent
// once ticked, with a line under its label.
export default {
  name: 'BsAuthOption',
  props: {
    value: { type: Boolean, default: false },
    label: { type: String, required: true },
    hint: { type: String, default: '' },
  },
};
</script>

<template>
  <label :class="['bs-auth-option', { 'bs-auth-option--on': value }]">
    <input
      type="checkbox"
      :checked="value"
      class="bs-auth-option__box"
      @change="$emit('input', $event.target.checked)"
    />
    <span class="bs-auth-option__text">
      <strong>{{ label }}</strong>
      <span v-if="hint">{{ hint }}</span>
    </span>
  </label>
</template>

<style lang="scss" scoped>
.bs-auth-option {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 16px;
  border: 1px solid var(--gray-300);
  border-radius: 7px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;

  &--on {
    border-color: var(--v-accent-base);
    background: var(--accent-tint-selected);
  }

  &__box {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin: 1px 0 0;
    accent-color: var(--v-accent-base);
    cursor: pointer;
  }

  &__text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--gray-600);
    font-size: 12px;
    line-height: 1.5;

    strong {
      color: var(--gray-900);
      font-size: 14px;
      font-weight: 500;
    }
  }
}
</style>
