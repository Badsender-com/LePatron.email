<script>
/**
 * Whether a value is the company's default of its dimension (ADR-0024): a new
 * email takes it when its template gives none. First-level dimensions only; a
 * child dimension's default is set under each parent value.
 */
export default {
  name: 'BsTaxonomyDefaultField',
  model: { prop: 'value', event: 'input' },
  props: {
    value: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
    // The server's refusal: another value already holds the place.
    errorMessage: { type: String, default: null },
  },
};
</script>

<template>
  <v-checkbox
    :input-value="value"
    :label="$t('taxonomy.values.form.isDefault')"
    :hint="$t('taxonomy.values.form.isDefaultHint')"
    :error-messages="errorMessage ? [errorMessage] : []"
    :disabled="disabled"
    color="accent"
    persistent-hint
    class="taxonomy-default-field"
    @change="$emit('input', Boolean($event))"
  />
</template>

<style lang="scss" scoped>
.taxonomy-default-field {
  margin: 0 0 1rem;
}
</style>
