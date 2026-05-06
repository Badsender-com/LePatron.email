<script>
export default {
  name: 'BsFormSection',
  props: {
    // When true, suppresses the bottom separator (use on the last section
    // when the wrapper already provides its own border, e.g. inside v-card).
    last: {
      type: Boolean,
      default: false,
    },
    // When true, drops the left indent under the icon — useful when the
    // content is a full-width table or grid that shouldn't be inset.
    flush: {
      type: Boolean,
      default: false,
    },
  },
};
</script>

<template>
  <div class="bs-form-section" :class="{ 'bs-form-section--last': last }">
    <div class="bs-form-section__header">
      <span v-if="$slots.icon" class="bs-form-section__icon">
        <slot name="icon" />
      </span>
      <div class="bs-form-section__heading">
        <h3 v-if="$slots.title" class="bs-form-section__title">
          <slot name="title" />
        </h3>
        <p v-if="$slots.description" class="bs-form-section__description">
          <slot name="description" />
        </p>
      </div>
      <div v-if="$slots.headerActions" class="bs-form-section__header-actions">
        <slot name="headerActions" />
      </div>
    </div>
    <div
      class="bs-form-section__content"
      :class="{ 'bs-form-section__content--flush': flush }"
    >
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-form-section {
  margin-bottom: 2rem;
  padding-bottom: 2rem;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08);

  &:last-of-type,
  &--last {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }

  &__header {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  &__icon {
    color: var(--v-accent-base);
    display: inline-flex;
    align-items: center;
    margin-top: 2px;
    flex-shrink: 0;
  }

  &__heading {
    flex: 1;
    min-width: 0;
  }

  &__title {
    font-size: 1rem;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87);
    margin: 0 0 0.25rem 0;
  }

  &__description {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
    margin: 0;
  }

  &__header-actions {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  &__content {
    padding-left: 2rem;

    &--flush {
      padding-left: 0;
    }
  }
}

@media (max-width: 600px) {
  .bs-form-section__content {
    padding-left: 0;
  }
}
</style>
