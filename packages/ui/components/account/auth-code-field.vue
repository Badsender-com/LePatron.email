<script>
// The field of a verification code, in the sign-in card: its label above,
// the digits large and spaced, the refusal under it rather than in a
// snackbar, and a row for the links that change what it takes.
let uid = 0;

export default {
  name: 'BsAuthCodeField',
  props: {
    value: { type: String, default: '' },
    label: { type: String, required: true },
    placeholder: { type: String, default: '000 000' },
    // A recovery code has letters: the keyboard follows.
    numeric: { type: Boolean, default: true },
    hint: { type: String, default: '' },
    error: { type: String, default: '' },
  },
  data() {
    uid += 1;
    return { id: `bs-auth-code-${uid}` };
  },
  computed: {
    describedBy() {
      if (this.error) return `${this.id}-error`;
      return this.hint ? `${this.id}-hint` : null;
    },
  },
  mounted() {
    this.focus();
  },
  methods: {
    // The code stays selected after a refusal: typing replaces it.
    focus({ select = false } = {}) {
      const input = this.$refs.input;
      if (!input) return;
      input.focus();
      if (select) input.select();
    },
  },
};
</script>

<template>
  <div :class="['bs-auth-code', { 'bs-auth-code--error': error }]">
    <label :for="id" class="bs-auth-code__label">{{ label }}</label>
    <input
      :id="id"
      ref="input"
      :value="value"
      name="code"
      type="text"
      autocomplete="one-time-code"
      :inputmode="numeric ? 'numeric' : 'text'"
      :placeholder="placeholder"
      :aria-invalid="error ? 'true' : null"
      :aria-describedby="describedBy"
      spellcheck="false"
      required
      class="bs-auth-code__input"
      @input="$emit('input', $event.target.value)"
    />
    <p
      v-if="error"
      :id="`${id}-error`"
      role="alert"
      class="bs-auth-code__error"
    >
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${id}-hint`" class="bs-auth-code__hint">
      {{ hint }}
    </p>
    <div v-if="$slots.default" class="bs-auth-code__links">
      <slot />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.bs-auth-code {
  display: flex;
  flex-direction: column;
  gap: 6px;

  &__label {
    color: var(--gray-700);
    font-size: 13px;
    font-weight: 500;
  }

  &__input {
    height: 48px;
    padding: 0 16px;
    border: 1px solid var(--field-border);
    border-radius: var(--r-sm);
    background: var(--surface);
    color: var(--gray-900);
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
      monospace;
    font-size: 20px;
    letter-spacing: 0.3em;
    text-align: center;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;

    &::placeholder {
      color: var(--gray-400);
    }

    &:hover {
      border-color: var(--field-border-hover);
    }

    &:focus {
      border-color: var(--v-accent-base);
      box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.18);
    }
  }

  &--error &__input {
    border-color: var(--color-error);

    &:focus {
      box-shadow: 0 0 0 3px var(--color-error-bg);
    }
  }

  &__error,
  &__hint {
    margin: 0;
    font-size: 12px;
    line-height: 1.5;
  }

  &__error {
    color: var(--v-error-darken1);
  }

  &__hint {
    color: var(--gray-600);
  }

  &__links {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    align-items: baseline;
    justify-content: space-between;
    margin-top: 2px;
    font-size: 13px;

    ::v-deep a,
    ::v-deep button.bs-auth-link {
      padding: 4px 0;
      border: 0;
      background: none;
      color: var(--v-accent-darken1);
      font: inherit;
      font-weight: 500;
      text-decoration: none;
      cursor: pointer;

      &:hover,
      &:focus-visible {
        color: var(--v-primary-base);
        text-decoration: underline;
      }

      &:disabled {
        color: var(--gray-500);
        cursor: default;
        text-decoration: none;
      }
    }
  }
}
</style>
