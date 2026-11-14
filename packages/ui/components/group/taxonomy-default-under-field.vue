<script>
import BsSelect from '~/components/form/bs-select.vue';
import { defaultUnderOffered } from '~/helpers/taxonomy-value-form.js';

/**
 * The parent values a child value is the default under (ADR-0024): a new email,
 * or one whose parent value changes, lands on it there. Restricted to the
 * values its availability offers it under, all of them when that is empty.
 */
export default {
  name: 'BsTaxonomyDefaultUnderField',
  components: { BsSelect },
  props: {
    // The ids of the parent values.
    value: { type: Array, default: () => [] },
    parentValues: { type: Array, default: () => [] },
    // The availability being edited: the ids of the parent values it lists.
    availability: { type: Array, default: () => [] },
    parentLabel: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
    // The server's refusal: another value already holds the place.
    errorMessage: { type: String, default: null },
  },
  computed: {
    items() {
      const offered = this.availability.map(String);
      const chosen = new Set(this.value.map(String));
      return this.parentValues
        .filter((parent) => parent.isActive || chosen.has(String(parent.id)))
        .filter(
          (parent) =>
            offered.length === 0 || offered.includes(String(parent.id))
        )
        .map((parent) => ({ value: String(parent.id), text: parent.label }));
    },
  },
  watch: {
    // Narrowing the availability takes the defaults it no longer offers.
    availability() {
      const kept = defaultUnderOffered({
        defaultUnder: this.value,
        parentIds: this.availability,
      });
      if (kept.length !== this.value.length) this.$emit('input', kept);
    },
  },
};
</script>

<template>
  <bs-select
    :value="value"
    :label="$t('taxonomy.values.form.defaultUnder')"
    :items="items"
    :hint="$t('taxonomy.values.form.defaultUnderHint', { parent: parentLabel })"
    :error-messages="errorMessage ? [errorMessage] : []"
    :disabled="disabled"
    persistent-hint
    multiple
    clearable
    class="taxonomy-default-under-field"
    @input="$emit('input', $event || [])"
  />
</template>

<style lang="scss" scoped>
.taxonomy-default-under-field {
  margin: 0 0 1rem;
}
</style>
