<script>
import { mapMutations } from 'vuex';
import {
  ArrowRight,
  Check,
  Copy,
  Mail,
  MailCheck,
  ShieldCheck,
  Smartphone,
} from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import {
  accountTwoFactorSetup,
  accountTwoFactorSetupConfirm,
} from '~/helpers/api-routes.js';
import {
  groupKey,
  isStepExpired,
  maskEmail,
  twoFactorErrorKey,
} from '~/helpers/two-factor.js';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsAuthCodeField from '~/components/account/auth-code-field.vue';
import BsAuthOption from '~/components/account/auth-option.vue';
import BsSendEmailCode from '~/components/account/send-email-code.vue';

// The setup of two-factor authentication, at the sign-in that follows the
// group requiring it (ADR 0008). Nothing is kept until a first code proves
// the method gives the right ones. Three steps the member sees: the method,
// the first code, the recovery codes (shown by the login page).
export default {
  name: 'BsTwoFactorSetup',
  components: {
    BsAuthCard,
    BsAuthCodeField,
    BsAuthOption,
    BsSendEmailCode,
    LucideArrowRight: ArrowRight,
    LucideCheck: Check,
    LucideCopy: Copy,
    LucideMail: Mail,
    LucideMailCheck: MailCheck,
    LucideShieldCheck: ShieldCheck,
    LucideSmartphone: Smartphone,
  },
  props: {
    email: { type: String, default: '' },
  },
  data() {
    return {
      method: 'totp',
      setup: null,
      code: '',
      trustDevice: false,
      loading: false,
      error: '',
      copied: false,
    };
  },
  computed: {
    maskedEmail() {
      return maskEmail(this.email);
    },
    title() {
      if (!this.setup) return this.$t('twoFactor.setup.title');
      return this.$t(`twoFactor.setup.titles.${this.setup.method}`);
    },
    eyebrow() {
      return this.$t('twoFactor.setup.step', { step: this.setup ? 2 : 1 });
    },
    key() {
      return groupKey(this.setup?.secret);
    },
  },
  watch: {
    code() {
      this.error = '';
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    fail(error) {
      if (isStepExpired(error)) this.$emit('expired');
      this.showSnackbar({
        text: this.$t(twoFactorErrorKey(error)),
        color: 'error',
      });
    },
    async start() {
      this.loading = true;
      try {
        this.setup = await this.$axios.$post(accountTwoFactorSetup(), {
          method: this.method,
        });
      } catch (error) {
        this.fail(error);
      } finally {
        this.loading = false;
      }
    },
    changeMethod() {
      this.setup = null;
      this.code = '';
    },
    async copyKey() {
      try {
        await navigator.clipboard.writeText(this.setup.secret);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    async confirm() {
      if (!this.code) return;
      this.loading = true;
      try {
        const answer = await this.$axios.$post(accountTwoFactorSetupConfirm(), {
          code: this.code.replace(/\s/g, ''),
          trustDevice: this.trustDevice,
        });
        this.$emit('answer', answer);
      } catch (error) {
        if (isStepExpired(error)) {
          this.fail(error);
          return;
        }
        this.error = this.$t(twoFactorErrorKey(error));
        this.$nextTick(() => this.$refs.field.focus({ select: true }));
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <bs-auth-card
    class="bs-two-factor-setup"
    :eyebrow="eyebrow"
    :title="title"
    :loading="loading"
  >
    <template #icon>
      <lucide-shield-check v-if="!setup" :size="26" />
      <lucide-mail-check v-else-if="setup.method === 'email'" :size="26" />
      <lucide-smartphone v-else :size="26" />
    </template>
    <template #description>
      <template v-if="!setup">{{ $t('twoFactor.setup.intro') }}</template>
      <template v-else-if="setup.method === 'email'">
        <i18n path="twoFactor.setup.emailSent" tag="span">
          <template #email>
            <strong>{{ maskedEmail }}</strong>
          </template>
        </i18n>
      </template>
      <template v-else>{{ $t('twoFactor.setup.scanIntro') }}</template>
    </template>

    <!-- The method -->
    <fieldset v-if="!setup" class="bs-two-factor-setup__methods">
      <legend class="bs-two-factor-setup__legend">
        {{ $t('twoFactor.setup.choose') }}
      </legend>
      <label
        v-for="option in ['totp', 'email']"
        :key="option"
        :class="[
          'bs-two-factor-setup__method',
          { 'bs-two-factor-setup__method--on': method === option },
        ]"
      >
        <input
          v-model="method"
          type="radio"
          name="method"
          :value="option"
          class="bs-two-factor-setup__radio"
        />
        <span class="bs-two-factor-setup__method-icon">
          <lucide-smartphone v-if="option === 'totp'" :size="18" />
          <lucide-mail v-else :size="18" />
        </span>
        <span class="bs-two-factor-setup__method-text">
          <strong>
            {{ $t(`twoFactor.setup.methods.${option}`) }}
            <span v-if="option === 'totp'" class="bs-two-factor-setup__badge">
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

    <!-- The authenticator app -->
    <template v-if="setup && setup.method === 'totp'">
      <div class="bs-two-factor-setup__scan">
        <img
          :src="setup.qrCode"
          :alt="$t('twoFactor.setup.qrCodeAlt')"
          width="160"
          height="160"
          class="bs-two-factor-setup__qr"
        />
        <ol class="bs-two-factor-setup__steps">
          <li v-for="n in 3" :key="n">
            <span class="bs-two-factor-setup__step-number">{{ n }}</span>
            <span>{{ $t(`twoFactor.setup.scanSteps.${n}`) }}</span>
          </li>
        </ol>
      </div>
      <div class="bs-two-factor-setup__manual">
        <span class="bs-two-factor-setup__legend">
          {{ $t('twoFactor.setup.manual') }}
        </span>
        <div class="bs-two-factor-setup__key">
          <code>{{ key }}</code>
          <v-btn
            small
            outlined
            :color="copied ? 'success' : 'primary'"
            @click="copyKey"
          >
            <lucide-check v-if="copied" :size="14" class="mr-1" />
            <lucide-copy v-else :size="14" class="mr-1" />
            {{
              copied
                ? $t('twoFactor.setup.keyCopied')
                : $t('twoFactor.setup.copyKey')
            }}
          </v-btn>
        </div>
      </div>
    </template>

    <!-- The first code -->
    <template v-if="setup">
      <form id="two-factor-setup-form" @submit.prevent="confirm">
        <bs-auth-code-field
          ref="field"
          v-model="code"
          :label="$t('twoFactor.code.label')"
          :hint="
            setup.method === 'email' ? $t('twoFactor.setup.emailHint') : ''
          "
          :error="error"
        >
          <bs-send-email-code
            v-if="setup.method === 'email'"
            sent-on-mount
            @expired="$emit('expired')"
          />
        </bs-auth-code-field>
      </form>
      <bs-auth-option
        v-model="trustDevice"
        :label="$t('twoFactor.code.trustDevice')"
        :hint="$t('twoFactor.code.trustDeviceHint')"
      />
    </template>

    <template #actions>
      <v-btn v-if="setup" text color="primary" @click="changeMethod">
        {{ $t('twoFactor.setup.changeMethod') }}
      </v-btn>
      <v-spacer v-if="setup" />
      <v-btn
        v-if="!setup"
        :loading="loading"
        elevation="0"
        color="accent"
        @click="start"
      >
        {{ $t('twoFactor.setup.start') }}
        <lucide-arrow-right :size="16" class="ml-2" />
      </v-btn>
      <v-btn
        v-else
        :loading="loading"
        elevation="0"
        color="accent"
        form="two-factor-setup-form"
        type="submit"
      >
        <lucide-check :size="16" class="mr-2" />
        {{ $t('twoFactor.setup.confirm') }}
      </v-btn>
    </template>
  </bs-auth-card>
</template>

<style lang="scss" scoped>
.bs-two-factor-setup {
  &__methods {
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

  &__scan {
    display: flex;
    gap: 20px;
    align-items: center;
  }

  &__qr {
    flex-shrink: 0;
    padding: 8px;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: var(--surface);
  }

  &__steps {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin: 0;
    padding: 0;
    list-style: none;
    color: var(--gray-700);
    font-size: 13px;
    line-height: 1.5;

    li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
  }

  &__step-number {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border-radius: var(--r-pill);
    background: var(--v-primary-base);
    color: var(--text-on-accent);
    font-size: 12px;
    font-weight: 600;
  }

  &__manual {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  &__key {
    display: flex;
    gap: 8px;
    align-items: center;
    padding: 6px 6px 6px 12px;
    border: 1px solid var(--gray-300);
    border-radius: var(--r-sm);
    background: var(--surface-muted);

    code {
      flex-grow: 1;
      min-width: 0;
      padding: 0;
      background: none;
      color: var(--gray-900);
      font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo,
        monospace;
      font-size: 13px;
      overflow-wrap: anywhere;
      user-select: all;
    }

    .v-btn {
      text-transform: none;
      letter-spacing: normal;
    }
  }

  @media (max-width: 480px) {
    &__scan {
      flex-direction: column;
    }
  }
}
</style>
