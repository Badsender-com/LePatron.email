<script>
/**
 * BsTextField - Custom text field with label above input
 *
 * Design system compliant text field that displays the label
 * above the input field (not floating/inline like Vuetify default).
 *
 * Usage:
 * <bs-text-field
 *   v-model="value"
 *   :label="$t('field.label')"
 *   :hint="$t('field.hint')"
 *   :error-messages="errors"
 * />
 */
export default {
  name: 'BsTextField',
  inheritAttrs: false,
  props: {
    value: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    errorMessages: { type: [String, Array], default: () => [] },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    type: { type: String, default: 'text' },
    placeholder: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    autofocus: { type: Boolean, default: false },
  },
  computed: {
    localValue: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    hasError() {
      if (Array.isArray(this.errorMessages)) {
        return this.errorMessages.length > 0;
      }
      return !!this.errorMessages;
    },
    normalizedErrors() {
      if (Array.isArray(this.errorMessages)) {
        return this.errorMessages;
      }
      return this.errorMessages ? [this.errorMessages] : [];
    },
  },
  methods: {
    onFocus(e) {
      this.$emit('focus', e);
    },
    onBlur(e) {
      this.$emit('blur', e);
    },
    onInput(e) {
      this.$emit('input', e);
    },
  },
};
</script>

<template>
  <div class="bs-text-field" :class="{ 'bs-text-field--error': hasError, 'bs-text-field--disabled': disabled }">
    <label v-if="label" class="bs-text-field__label">
      {{ label }}
      <span v-if="required" class="bs-text-field__required">*</span>
    </label>
    <v-text-field
      v-model="localValue"
      v-bind="$attrs"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autofocus="autofocus"
      :error-messages="normalizedErrors"
      solo
      flat
      hide-details="auto"
      class="bs-text-field__input"
      v-on="$listeners"
      @focus="onFocus"
      @blur="onBlur"
    />
    <div v-if="hint && !hasError" class="bs-text-field__hint">
      {{ hint }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-text-field {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }

  &__input {
    &.v-text-field.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        background: #fff;
        min-height: 40px;
        padding: 0 12px;
        transition: border-color 0.2s ease;

        &:hover {
          border-color: rgba(0, 0, 0, 0.4);
        }
      }

      &.v-input--is-focused ::v-deep .v-input__slot {
        border-color: #00acdc;
      }

      &.error--text ::v-deep .v-input__slot {
        border-color: #f04e23;
      }

      ::v-deep input {
        font-size: 0.875rem;
        padding: 8px 0;
      }

      ::v-deep .v-text-field__details {
        padding: 4px 0 0 0;
        min-height: auto;
      }

      ::v-deep .v-messages__message {
        font-size: 0.75rem;
      }
    }
  }

  &__hint {
    font-size: 0.75rem;
    color: rgba(0, 0, 0, 0.5);
    margin-top: 0.25rem;
    padding-left: 2px;
  }

  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &--error {
    .bs-text-field__label {
      color: #f04e23;
    }
  }
}
</style>
