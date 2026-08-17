<script>
/**
 * BsCombobox - Custom combobox with label above input
 *
 * Design system compliant combobox that displays the label above the input,
 * mirroring the BsSelect pattern. Used for free-tag inputs (multiple) or
 * single-value selects-with-write.
 */
export default {
  name: 'BsCombobox',
  inheritAttrs: false,
  props: {
    value: { type: [String, Number, Array, Object], default: null },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    items: { type: Array, default: () => [] },
    errorMessages: { type: [String, Array], default: () => [] },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    multiple: { type: Boolean, default: false },
    clearable: { type: Boolean, default: false },
    chips: { type: Boolean, default: false },
    smallChips: { type: Boolean, default: false },
  },
  data() {
    return {
      // Mirror of the v-combobox internal search input so we can commit any
      // pending tag synchronously when the field loses focus.
      searchInput: '',
    };
  },
  computed: {
    localValue: {
      get() {
        return this.value;
      },
      set(val) {
        // Clear the typed search once a value is committed so it doesn't
        // linger in the field after a selection (§2).
        this.searchInput = '';
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
    /**
     * Vuetify's v-combobox commits a typed-but-unconfirmed tag on blur via
     * an async internal handler, so clicking a Save button next to the
     * field can race the commit. We push the pending searchInput into the
     * value array synchronously on blur, guaranteeing the parent v-model
     * is up-to-date by the time the click handler runs.
     */
    handleBlur(event) {
      const pending = (this.searchInput || '').trim();
      if (pending) {
        if (this.multiple) {
          const current = Array.isArray(this.localValue) ? this.localValue : [];
          if (!current.includes(pending)) {
            this.localValue = [...current, pending];
          }
        } else {
          this.localValue = pending;
        }
        this.searchInput = '';
      }
      this.$emit('blur', event);
    },
  },
};
</script>

<template>
  <div
    class="bs-combobox"
    :class="{
      'bs-combobox--error': hasError,
      'bs-combobox--disabled': disabled,
    }"
  >
    <label v-if="label" class="bs-combobox__label">
      {{ label }}
      <span v-if="required" class="bs-combobox__required">*</span>
    </label>
    <v-combobox
      v-model="localValue"
      :search-input.sync="searchInput"
      v-bind="$attrs"
      :items="items"
      :placeholder="placeholder"
      :disabled="disabled"
      :multiple="multiple"
      :clearable="clearable"
      :chips="chips"
      :small-chips="smallChips"
      :error-messages="normalizedErrors"
      solo
      flat
      hide-details="auto"
      class="bs-combobox__input"
      v-on="$listeners"
      @blur="handleBlur"
    />
    <div v-if="hint && !hasError" class="bs-combobox__hint">
      {{ hint }}
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-combobox {
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
    &.v-select.v-text-field--solo {
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

      ::v-deep .v-select__selections {
        font-size: 0.875rem;
        padding: 4px 0;
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
    .bs-combobox__label {
      color: #f04e23;
    }
  }
}
</style>
