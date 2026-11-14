<script>
import { initialsOfEmail } from '~/helpers/two-factor.js';
import BsLoginLogo from '~/components/account/login-logo.vue';

// The card of the sign-in steps, after the consent of a connected application
// and the LePatron design system: the logo, a 480px white card with its
// header (eyebrow, round icon, title, sentence), who signs in, the body, the
// actions, and the signature under the card.
export default {
  name: 'BsAuthCard',
  components: { BsLoginLogo },
  props: {
    title: { type: String, required: true },
    // Over the icon: where the member is in a sequence ("Step 2 of 3").
    eyebrow: { type: String, default: '' },
    // Who signs in, from the first step on; the link back to the first step
    // shows when the page listens to `change-account`.
    email: { type: String, default: '' },
    // A request on its way: a thin bar over the card.
    loading: { type: Boolean, default: false },
    // What went wrong before this step, said over the body (the sign-in
    // through the identity provider, an expired link…).
    alert: { type: String, default: '' },
  },
  computed: {
    initials() {
      return initialsOfEmail(this.email);
    },
  },
};
</script>

<template>
  <div class="bs-auth-card">
    <div class="bs-auth-card__brand">
      <bs-login-logo />
    </div>

    <v-card class="bs-auth-card__card">
      <v-progress-linear
        v-if="loading"
        indeterminate
        color="accent"
        absolute
        top
      />
      <header class="bs-auth-card__header">
        <span v-if="eyebrow" class="bs-auth-card__eyebrow">{{ eyebrow }}</span>
        <span v-if="$slots.icon" class="bs-auth-card__icon" aria-hidden="true">
          <slot name="icon" />
        </span>
        <h1 class="bs-auth-card__title">{{ title }}</h1>
        <p v-if="$slots.description" class="bs-auth-card__description">
          <slot name="description" />
        </p>
      </header>

      <div class="bs-auth-card__body">
        <p v-if="alert" role="alert" class="bs-auth-card__alert">
          {{ alert }}
        </p>
        <div v-if="email" class="bs-auth-card__account">
          <span class="bs-auth-card__avatar" aria-hidden="true">
            {{ initials }}
          </span>
          <span class="bs-auth-card__who">{{ email }}</span>
          <a
            v-if="$listeners['change-account']"
            href="#"
            @click.prevent="$emit('change-account')"
          >
            {{ $t('authCard.changeAccount') }}
          </a>
        </div>
        <slot />
      </div>

      <footer v-if="$slots.actions" class="bs-auth-card__actions">
        <slot name="actions" />
      </footer>
    </v-card>

    <p class="bs-auth-card__signature">Powered by <strong>Badsender</strong></p>
  </div>
</template>

<style lang="scss" scoped>
.bs-auth-card {
  // Out of the login layout's narrow column: 480px, centred on the page.
  position: relative;
  left: 50%;
  width: min(480px, calc(100vw - 32px));
  transform: translateX(-50%);
  color: var(--gray-900);
  text-align: left;

  &__brand {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }

  &__card.v-card {
    border-radius: var(--r-md);
    box-shadow: 0 12px 32px rgba(13, 43, 62, 0.18);
    overflow: hidden;
  }

  &__header {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    padding: 32px 32px 24px;
    text-align: center;
  }

  &__eyebrow {
    color: var(--gray-600);
    font-size: 11px;
    font-weight: 500;
    line-height: 1.3;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: var(--r-pill);
    background: rgba(0, 172, 220, 0.12);
    color: var(--v-accent-darken1);
  }

  &__title {
    margin: 0 0 -8px;
    color: var(--v-primary-base);
    font-size: 20px;
    font-weight: 600;
    line-height: 1.3;
  }

  &__description {
    max-width: 380px;
    margin: 0;
    color: var(--gray-700);
    font-size: 14px;
    line-height: 1.5;

    ::v-deep strong {
      color: var(--gray-900);
      font-weight: 500;
    }
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 0 32px 24px;
  }

  &__alert {
    margin: 0;
    padding: 12px 16px;
    border: 1px solid rgba(240, 78, 35, 0.35);
    border-radius: 7px;
    background: var(--color-error-bg);
    color: var(--gray-900);
    font-size: 13px;
    line-height: 1.5;
  }

  &__account {
    display: flex;
    gap: 12px;
    align-items: center;
    padding: 10px 16px;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: var(--surface-muted);

    a {
      color: var(--v-accent-darken1);
      font-size: 13px;
      font-weight: 500;
      text-decoration: none;
      white-space: nowrap;

      &:hover,
      &:focus-visible {
        color: var(--v-primary-base);
        text-decoration: underline;
      }
    }
  }

  &__avatar {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--v-primary-base);
    color: var(--text-on-accent);
    font-size: 13px;
    font-weight: 600;
  }

  &__who {
    flex-grow: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    font-size: 14px;
  }

  &__actions {
    display: flex;
    gap: 8px;
    align-items: center;
    justify-content: flex-end;
    padding: 16px 32px;
    border-top: 1px solid var(--gray-200);

    ::v-deep .v-btn {
      text-transform: none;
      letter-spacing: normal;
    }
  }

  &__signature {
    margin: 24px 0 0;
    color: var(--v-primary-lighten5);
    font-size: 12px;
    text-align: center;
  }

  // On a phone, the actions take the width, the main one on top.
  @media (max-width: 480px) {
    &__header,
    &__body,
    &__actions {
      padding-left: 20px;
      padding-right: 20px;
    }

    &__actions {
      flex-direction: column-reverse;
      align-items: stretch;

      ::v-deep .v-btn {
        width: 100%;
        min-height: 44px;
      }
    }
  }
}
</style>
