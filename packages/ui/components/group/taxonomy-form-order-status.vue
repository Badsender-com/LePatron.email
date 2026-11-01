<script>
import BsTextField from '~/components/form/bs-text-field.vue';

/**
 * The order and status of a value, side by side. Bound with `.sync`.
 */
export default {
  name: 'BsTaxonomyFormOrderStatus',
  components: { BsTextField },
  props: {
    order: { type: [Number, String], default: 0 },
    isActive: { type: Boolean, default: true },
    activeHint: { type: String, default: '' },
    loading: { type: Boolean, default: false },
  },
};
</script>

<template>
  <!-- Two columns, each with its own label above the control, so this row reads
       like the fields above it rather than as a stray switch. -->
  <div class="taxonomy-form__row">
    <div class="taxonomy-form__col">
      <!-- `min`/`step` rather than a free number: an order the server refuses
           comes back as a generic 400, which the snackbar can only render as
           "an error occurred" — no message next to the field to fix.
           buildTaxonomyPayload does the rest, so nothing unusable is sent. -->
      <bs-text-field
        :value="order"
        :label="$t('taxonomy.form.order')"
        :hint="$t('taxonomy.form.orderHint')"
        :disabled="loading"
        type="number"
        min="0"
        step="1"
        @input="$emit('update:order', $event)"
      />
    </div>

    <!-- A fieldset rather than a bare span: the column needs a heading to line
         up with the label opposite, and a heading a screen reader ignores is
         decoration. -->
    <fieldset class="taxonomy-form__col taxonomy-form__fieldset">
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
  </div>
</template>

<style lang="scss" scoped>
.taxonomy-form {
  &__row {
    display: flex;
    align-items: flex-start;
    gap: 1.5rem;
  }

  &__col {
    flex: 1 1 0;
    min-width: 0;
  }

  &__fieldset {
    border: 0;
    padding: 0;
    margin: 0;
  }

  // Same typography as the bs-* field labels, so the two columns line up.
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
