<script>
/**
 * BsTextarea - Custom textarea with label above input
 *
 * Design system compliant textarea that displays the label above
 * the input, mirroring the BsTextField pattern.
 */
import mixinInputId from '~/helpers/mixins/mixin-input-id.js';

export default {
  name: 'BsTextarea',
  mixins: [mixinInputId],
  inheritAttrs: false,
  props: {
    value: { type: [String, Number], default: '' },
    label: { type: String, default: '' },
    hint: { type: String, default: '' },
    errorMessages: { type: [String, Array], default: () => [] },
    disabled: { type: Boolean, default: false },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
    readonly: { type: Boolean, default: false },
    rows: { type: [Number, String], default: 3 },
    autoGrow: { type: Boolean, default: false },
    monospace: { type: Boolean, default: false },
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
};
</script>

<template>
  <div
    class="bs-textarea"
    :class="{
      'bs-textarea--error': hasError,
      'bs-textarea--disabled': disabled,
      'bs-textarea--monospace': monospace,
    }"
  >
    <label v-if="label" :for="inputId" class="bs-textarea__label">
      {{ label }}
      <span v-if="required" class="bs-textarea__required">*</span>
    </label>
    <v-textarea
      :id="inputId"
      v-model="localValue"
      :aria-required="required ? 'true' : null"
      :aria-invalid="hasError ? 'true' : null"
      :aria-describedby="describedBy"
      v-bind="$attrs"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :rows="rows"
      :auto-grow="autoGrow"
      :error-messages="normalizedErrors"
      solo
      flat
      hide-details="auto"
      class="bs-textarea__input"
      v-on="$listeners"
    >
      <!-- Vuetify already flags the message container `role="alert"`; the id
           is ours to add, so `aria-describedby` has something to point at.
           Only the first message is tagged: `error-count` defaults to 1, and a
           caller raising it must not produce duplicate ids. -->
      <template #message="{ message, key }">
        <span :id="key === 0 ? errorId : null">{{ message }}</span>
      </template>
    </v-textarea>
    <div v-if="hint && !hasError" :id="hintId" class="bs-textarea__hint">
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
    color: rgba(0, 0, 0, 0.6);
    margin-bottom: 0.375rem;
  }

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }

  &__input {
    &.v-textarea.v-text-field--solo {
      ::v-deep .v-input__slot {
        border: 1px solid rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        background: #fff;
        padding: 8px 12px;
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

      ::v-deep textarea {
        font-size: 0.875rem;
        line-height: 1.5;
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
    .bs-textarea__label {
      color: #f04e23;
    }
  }

  &--monospace {
    .bs-textarea__input ::v-deep textarea {
      font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
      font-size: 0.8125rem;
    }
  }
}
</style>
