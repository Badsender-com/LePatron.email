<script>
/**
 * BsTextarea - Custom textarea with label above input
 *
 * The design system had bs-text-field and bs-select but no textarea, so every
 * screen needing one copied the same `.bs-textarea` markup and styles into its own
 * scoped block (modal-create-emails-group, form-emails-group, ftp-settings,
 * crm-intelligence-tab, template/form). Those copies use hardcoded colours;
 * this component uses the same design tokens as bs-text-field, so a token change
 * reaches it.
 *
 * Existing copies are deliberately left alone — migrating them belongs to its own
 * change, not to a feature PR.
 *
 * Usage:
 * <bs-textarea
 *   v-model="value"
 *   :label="$t('field.label')"
 *   :hint="$t('field.hint')"
 *   :error-messages="errors"
 *   rows="4"
 * />
 */
export default {
  name: 'BsTextarea',
  inheritAttrs: false,
  props: {
    value: { type: String, default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    errorMessages: { type: [String, Array], default: () => [] },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    rows: { type: [String, Number], default: 3 },
    counter: { type: [String, Number, Boolean], default: false },
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
      return this.normalizedErrors.length > 0;
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
  },
};
</script>

<template>
  <div
    class="bs-textarea"
    :class="{
      'bs-textarea--error': hasError,
      'bs-textarea--disabled': disabled,
    }"
  >
    <label v-if="label" class="bs-textarea__label">
      {{ label }}
      <span v-if="required" class="bs-textarea__required">*</span>
    </label>
    <v-textarea
      v-model="localValue"
      v-bind="$attrs"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :counter="counter"
      :autofocus="autofocus"
      :error-messages="normalizedErrors"
      solo
      flat
      hide-details="auto"
      class="bs-textarea__input"
      v-on="$listeners"
      @focus="onFocus"
      @blur="onBlur"
    />
    <div v-if="hint && !hasError" class="bs-textarea__hint">
      {{ hint }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-textarea {
  margin-bottom: 1rem;

  &__label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--gray-700);
    margin-bottom: 0.375rem;
  }

  &__required {
    color: var(--color-error);
    margin-left: 2px;
  }

  &__input {
    &.v-textarea.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid var(--field-border);
        border-radius: var(--r-sm);
        background: var(--surface);
        padding: 8px 12px;
        transition: border-color 0.2s ease;

        &:hover {
          border-color: var(--field-border-hover);
        }
      }

      &.v-input--is-focused ::v-deep .v-input__slot {
        border-color: var(--v-accent-base, #00acdc);
      }

      &.error--text ::v-deep .v-input__slot {
        border-color: var(--color-error);
      }

      ::v-deep textarea {
        font-size: 0.875rem;
        line-height: 1.5;

        &::placeholder {
          color: var(--field-placeholder);
          font-size: 0.875rem;
        }
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
    color: var(--field-placeholder);
    margin-top: 0.25rem;
    padding-left: 2px;
  }

  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &--error {
    .bs-textarea__label {
      color: var(--color-error);
    }
  }
}
</style>
