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
import mixinInputId from '~/helpers/mixins/mixin-input-id.js';

export default {
  name: 'BsTextField',
  mixins: [mixinInputId],
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
    hideLabel: { type: Boolean, default: false },
    dense: { type: Boolean, default: false },
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
  <div
    class="bs-text-field"
    :class="{
      'bs-text-field--error': hasError,
      'bs-text-field--disabled': disabled,
      'bs-text-field--dense': dense,
    }"
  >
    <!-- `hide-label` hides the label from sight, not from the accessibility
         tree: a field with no name at all is what this component was fixing. -->
    <label
      v-if="label"
      :for="inputId"
      class="bs-text-field__label"
      :class="{ 'bs-visually-hidden': hideLabel }"
    >
      {{ label }}
      <span v-if="required" class="bs-text-field__required">*</span>
    </label>
    <v-text-field
      :id="inputId"
      v-model="localValue"
      :aria-required="required ? 'true' : null"
      :aria-invalid="hasError ? 'true' : null"
      :aria-describedby="describedBy"
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
    >
      <!-- Vuetify already flags the message container `role="alert"`; the id
           is ours to add, so `aria-describedby` has something to point at.
           Only the first message is tagged: `error-count` defaults to 1, and a
           caller raising it must not produce duplicate ids. -->
      <template #message="{ message, key }">
        <span :id="key === 0 ? errorId : null">{{ message }}</span>
      </template>
    </v-text-field>
    <div v-if="hint && !hasError" :id="hintId" class="bs-text-field__hint">
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
    color: var(--gray-700);
    margin-bottom: 0.375rem;
  }

  &__required {
    color: var(--color-error);
    margin-left: 2px;
  }

  &__input {
    &.v-text-field.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid var(--field-border);
        border-radius: var(--r-sm);
        background: var(--surface);
        min-height: 40px;
        padding: 0 12px;
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
    color: var(--field-placeholder);
    margin-top: 0.25rem;
    padding-left: 2px;
  }

  &--disabled {
    opacity: 0.6;
    pointer-events: none;
  }

  &--error {
    .bs-text-field__label {
      color: var(--color-error);
    }
  }

  &--dense {
    margin-bottom: 0;

    .bs-text-field__input {
      &.v-text-field.v-text-field--solo {
        ::v-deep .v-input__slot {
          min-height: 36px;
        }

        ::v-deep input {
          padding: 6px 0;
        }
      }
    }
  }
}
</style>
