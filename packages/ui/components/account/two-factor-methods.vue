<script>
import { Mail, Smartphone } from 'lucide-vue';

import { maskEmail } from '~/helpers/two-factor.js';

// The first step of the setup (ADR 0008): the method, as radio cards, the
// authenticator app recommended.
export default {
  name: 'BsTwoFactorMethods',
  components: { LucideMail: Mail, LucideSmartphone: Smartphone },
  props: {
    value: { type: String, default: 'totp' },
    email: { type: String, default: '' },
  },
  computed: {
    maskedEmail() {
      return maskEmail(this.email);
    },
  },
};
</script>

<template>
  <fieldset class="bs-two-factor-methods__fieldset">
    <legend class="bs-two-factor-methods__legend">
      {{ $t('twoFactor.setup.choose') }}
    </legend>
    <label
      v-for="option in ['totp', 'email']"
      :key="option"
      :class="[
        'bs-two-factor-methods__method',
        { 'bs-two-factor-methods__method--on': value === option },
      ]"
    >
      <input
        :checked="value === option"
        type="radio"
        name="method"
        :value="option"
        class="bs-two-factor-methods__radio"
        @change="$emit('input', option)"
      />
      <span class="bs-two-factor-methods__method-icon">
        <lucide-smartphone v-if="option === 'totp'" :size="18" />
        <lucide-mail v-else :size="18" />
      </span>
      <span class="bs-two-factor-methods__method-text">
        <strong>
          {{ $t(`twoFactor.setup.methods.${option}`) }}
          <span v-if="option === 'totp'" class="bs-two-factor-methods__badge">
            {{ $t('twoFactor.setup.recommended') }}
          </span>
        </strong>
        <span>
          {{
            $t(`twoFactor.setup.methodHints.${option}`, {
              email: maskedEmail,
            })
          }}
        </span>
      </span>
    </label>
  </fieldset>
</template>

<style lang="scss" scoped>
.bs-two-factor-methods {
  &__fieldset {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin: 0;
    padding: 0;
    border: 0;
  }

  &__legend {
    margin-bottom: 4px;
    padding: 0;
    color: var(--gray-600);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__method {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 14px 16px;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    cursor: pointer;
    transition: border-color 0.15s, background 0.15s;

    &:focus-within {
      box-shadow: 0 0 0 3px rgba(0, 172, 220, 0.18);
    }

    &--on {
      border-color: var(--v-accent-base);
      background: var(--accent-tint-selected);
    }
  }

  &__radio {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin: 7px 0 0;
    accent-color: var(--v-accent-base);
    cursor: pointer;
  }

  &__method-icon {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: var(--r-pill);
    background: var(--gray-100);
    color: var(--gray-700);
  }

  &__method--on &__method-icon {
    background: rgba(0, 172, 220, 0.12);
    color: var(--v-accent-darken1);
  }

  &__method-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    color: var(--gray-600);
    font-size: 12px;
    line-height: 1.5;

    strong {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      color: var(--gray-900);
      font-size: 14px;
      font-weight: 500;
    }
  }

  &__badge {
    padding: 2px 8px;
    border-radius: var(--r-pill);
    background: rgba(0, 172, 220, 0.12);
    color: var(--v-accent-darken1);
    font-size: 11px;
    font-weight: 500;
  }
}
</style>
