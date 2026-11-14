<script>
import BsSelect from '~/components/form/bs-select.vue';
import { SCOPES } from '~/helpers/taxonomy-dimension-form.js';

/**
 * Which emails a dimension is offered on (ADR-0024): every one, or only those
 * whose template reads it. Fixed to every email for a dimension holding a role.
 */
export default {
  name: 'BsTaxonomyScopeField',
  components: { BsSelect },
  props: {
    value: { type: String, default: 'all' },
    fixed: { type: Boolean, default: false },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    items() {
      return SCOPES.map((scope) => ({
        value: scope,
        text: this.$t(`taxonomy.dimensions.scopes.${scope}`),
      }));
    },
  },
};
</script>

<template>
  <bs-select
    :value="fixed ? 'all' : value"
    :label="$t('taxonomy.dimensions.form.scope')"
    :items="items"
    :hint="
      $t(
        fixed
          ? 'taxonomy.dimensions.form.scopeFixedHint'
          : 'taxonomy.dimensions.form.scopeHint'
      )
    "
    :disabled="disabled || fixed"
    persistent-hint
    @input="$emit('input', $event)"
  />
</template>
