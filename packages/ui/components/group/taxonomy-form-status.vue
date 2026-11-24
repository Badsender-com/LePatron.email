<script>
/**
 * The status of a value, in its panel. Bound with `.sync`. Its order is set
 * by drag and drop in the list (ADR-0026), never typed.
 */
export default {
  name: 'BsTaxonomyFormStatus',
  props: {
    isActive: { type: Boolean, default: true },
    activeHint: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
};
</script>

<template>
  <!-- A fieldset rather than a bare span: the switch needs a heading to read
       like the fields above it, and a heading a screen reader ignores is
       decoration. -->
  <fieldset class="taxonomy-form__fieldset">
    <legend class="taxonomy-form__label">
      {{ $t('taxonomy.form.status') }}
    </legend>
    <v-switch
      :input-value="isActive"
      :label="$t('taxonomy.form.isActive')"
      :disabled="loading"
      color="accent"
      inset
      hide-details
      class="taxonomy-form__switch"
      @change="$emit('update:isActive', Boolean($event))"
    />
    <p class="taxonomy-form__hint">
      {{ activeHint }}
    </p>
  </fieldset>
</template>

<style lang="scss" scoped>
.taxonomy-form {
  &__fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  // Same typography as the bs-* field labels.
  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--gray-700);
    margin-bottom: 0.375rem;
  }

  &__switch {
    margin-top: 0;
    padding-top: 0.375rem;
  }

  &__hint {
    font-size: 0.75rem;
    color: var(--field-placeholder);
    margin: 0.25rem 0 0 0;
    padding-left: 2px;
  }
}
</style>
