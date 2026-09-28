<script>
/**
 * BsIntegrationConfigFields - the provider-specific switches of an integration.
 *
 * Driven by `configFields` in provider-configs.js, so a provider declares what
 * it reads rather than the form growing a branch per provider. Only boolean
 * settings for now: the others (Azure deployment, API version) have no field
 * on purpose — the deployment is the model picked per feature.
 *
 * Emits the whole config object, the keys it does not render left untouched.
 */
export default {
  name: 'BsIntegrationConfigFields',
  props: {
    /** [{ key, labelKey, hintKey }] */
    fields: { type: Array, default: () => [] },
    value: { type: Object, default: () => ({}) },
    disabled: { type: Boolean, default: false },
  },
  methods: {
    update(key, checked) {
      this.$emit('input', { ...this.value, [key]: !!checked });
    },
  },
};
</script>

<template>
  <div v-if="fields.length > 0" class="bs-integration-config-fields">
    <v-checkbox
      v-for="field in fields"
      :key="field.key"
      :input-value="value[field.key] === true"
      :label="$t(field.labelKey)"
      :hint="field.hintKey ? $t(field.hintKey) : ''"
      :disabled="disabled"
      persistent-hint
      color="accent"
      class="mt-0 mb-2"
      @change="update(field.key, $event)"
    />
  </div>
</template>
