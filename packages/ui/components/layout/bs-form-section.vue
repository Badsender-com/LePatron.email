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
    // When true, hides the content: a feature switched off folds its
    // settings under its header. v-show, so the content stays mounted.
    folded: {
      type: Boolean,
      default: false,
    },
    // When true, the section is a card of its own: bordered, its icon on a
    // tile, its content under a rule. For pages that stack features.
    card: {
      type: Boolean,
      default: false,
    },
    // A card's icon tile is tinted while its feature is on, grey when off.
    active: {
      type: Boolean,
      default: true,
    },
  },
};
</script>

<template>
  <div
    class="bs-form-section"
    :class="{
      'bs-form-section--last': last,
      'bs-form-section--folded': folded,
      'bs-form-section--card': card,
      'bs-form-section--idle': card && !active,
    }"
  >
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
      <div
        v-if="$slots['header-actions']"
        class="bs-form-section__header-actions"
      >
        <slot name="header-actions" />
      </div>
    </div>
    <div
      v-show="!folded"
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

  &--folded &__header {
    margin-bottom: 0;
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

// A card: the page stacks them on a grey ground, 12px apart.
.bs-form-section--card {
  margin-bottom: 12px;
  padding-bottom: 0;
  border: 1px solid var(--gray-300);
  border-radius: var(--r-md);
  background: var(--surface);
  overflow: hidden;

  &:last-of-type {
    margin-bottom: 0;
    border: 1px solid var(--gray-300);
  }

  .bs-form-section__header {
    align-items: center;
    gap: 1rem;
    margin-bottom: 0;
    padding: 20px 24px;
  }

  .bs-form-section__icon {
    width: 40px;
    height: 40px;
    margin-top: 0;
    justify-content: center;
    border-radius: 7px;
    background: rgba(0, 172, 220, 0.12);
    color: var(--v-accent-darken1);
  }

  .bs-form-section__title {
    margin-bottom: 2px;
    color: var(--gray-900);
  }

  .bs-form-section__description {
    font-size: 0.8125rem;
    color: var(--gray-600);
  }

  .bs-form-section__content {
    padding: 20px 24px;
    border-top: 1px solid var(--gray-200);

    &--flush {
      padding: 0;
    }
  }
}

.bs-form-section--idle .bs-form-section__icon {
  background: var(--gray-100);
  color: var(--gray-600);
}

@media (max-width: 600px) {
  .bs-form-section__content {
    padding-left: 0;
  }
}
</style>
