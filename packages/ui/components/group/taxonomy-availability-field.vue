<script>
import BsSelect from '~/components/form/bs-select.vue';

/**
 * The availability of a value (ADR-0014): the values of the parent dimension it
 * is offered under. Left empty, it is offered under all of them.
 *
 * A deactivated parent value is offered only when the value already lists it:
 * dropping it from the choices would take it out of the availability on save.
 */
export default {
  name: 'BsTaxonomyAvailabilityField',
  components: { BsSelect },
  props: {
    // The ids of the parent values.
    value: { type: Array, default: () => [] },
    parentValues: { type: Array, default: () => [] },
    parentLabel: { type: String, default: '' },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    items() {
      const chosen = new Set(this.value.map(String));
      return this.parentValues
        .filter((parent) => parent.isActive || chosen.has(String(parent.id)))
        .map((parent) => ({ value: String(parent.id), text: parent.label }));
    },
  },
};
</script>

<template>
  <bs-select
    :value="value"
    :label="$t('taxonomy.values.form.availability')"
    :items="items"
    :hint="$t('taxonomy.values.form.availabilityHint', { parent: parentLabel })"
    :disabled="disabled"
    multiple
    clearable
    @input="$emit('input', $event || [])"
  />
</template>
