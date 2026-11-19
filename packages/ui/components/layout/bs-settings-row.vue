<script>
// One setting in a list of them: a title and a sentence on the left, its
// control on the right. A list item: the rows sit in a <ul>.
export default {
  name: 'BsSettingsRow',
  props: {
    // Lets the control name itself after the title (aria-labelledby).
    titleId: { type: String, default: null },
  },
};
</script>

<template>
  <li class="bs-settings-row">
    <div class="bs-settings-row__text">
      <span :id="titleId" class="bs-settings-row__title">
        <slot name="title" />
      </span>
      <span v-if="$slots.description" class="bs-settings-row__description">
        <slot name="description" />
      </span>
    </div>
    <div class="bs-settings-row__action">
      <slot />
    </div>
  </li>
</template>

<style lang="scss" scoped>
.bs-settings-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 0;
  border-top: 1px solid rgba(0, 0, 0, 0.08);

  &__text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  &__title {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
  }

  &__description {
    font-size: 0.8125rem;
    color: rgba(0, 0, 0, 0.6);
  }

  &__action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
}
</style>
