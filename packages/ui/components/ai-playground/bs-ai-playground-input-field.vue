<script>
/**
 * BsAiPlaygroundInputField — renders ONE field of a skill input schema, picked
 * from the schema descriptor ({name, type, required, multiline}). Stateless:
 * value in, typed value out.
 *
 * Emits `input` with a properly typed value; an emptied field emits
 * `undefined` (never '' or NaN) so optional keys are dropped from the input
 * object instead of failing the skill's strict zod validation.
 */
import BsTextField from '~/components/form/bs-text-field.vue';
import BsTextarea from '~/components/form/bs-textarea.vue';

export default {
  name: 'BsAiPlaygroundInputField',
  components: { BsTextField, BsTextarea },
  props: {
    field: { type: Object, required: true },
    value: { type: [String, Number, Boolean], default: undefined },
    label: { type: String, required: true },
    placeholder: { type: String, default: '' },
    errorMessages: { type: Array, default: () => [] },
    disabled: { type: Boolean, default: false },
  },
  computed: {
    stringValue() {
      return this.value == null ? '' : String(this.value);
    },
    booleanValue() {
      return this.value === true;
    },
  },
  methods: {
    onStringInput(text) {
      this.$emit('input', text === '' ? undefined : text);
    },
    onNumberInput(text) {
      if (text === '' || text == null) {
        this.$emit('input', undefined);
        return;
      }
      const parsed = Number(text);
      this.$emit('input', Number.isNaN(parsed) ? undefined : parsed);
    },
    onBooleanInput(checked) {
      this.$emit('input', !!checked);
    },
  },
};
</script>

<template>
  <div class="bs-ai-playground-input-field">
    <bs-textarea
      v-if="field.type === 'string' && field.multiline"
      :value="stringValue"
      :label="label"
      :placeholder="placeholder"
      :required="field.required"
      :rows="4"
      auto-grow
      :error-messages="errorMessages"
      :disabled="disabled"
      @input="onStringInput"
    />
    <bs-text-field
      v-else-if="field.type === 'string'"
      :value="stringValue"
      :label="label"
      :placeholder="placeholder"
      :required="field.required"
      :error-messages="errorMessages"
      :disabled="disabled"
      @input="onStringInput"
    />
    <bs-text-field
      v-else-if="field.type === 'number'"
      :value="stringValue"
      :label="label"
      :placeholder="placeholder"
      :required="field.required"
      type="number"
      :error-messages="errorMessages"
      :disabled="disabled"
      @input="onNumberInput"
    />
    <v-switch
      v-else-if="field.type === 'boolean'"
      :input-value="booleanValue"
      :label="label"
      :error-messages="errorMessages"
      :disabled="disabled"
      color="accent"
      hide-details="auto"
      class="mt-0 mb-4"
      @change="onBooleanInput"
    />
  </div>
</template>
