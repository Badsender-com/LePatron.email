<script>
import { mapMutations } from 'vuex';
import {
  ArrowRight,
  Check,
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
  isStepExpired,
  maskEmail,
  twoFactorErrorKey,
} from '~/helpers/two-factor.js';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsAuthCodeField from '~/components/account/auth-code-field.vue';
import BsAuthOption from '~/components/account/auth-option.vue';
import BsSendEmailCode from '~/components/account/send-email-code.vue';
import BsTwoFactorMethods from '~/components/account/two-factor-methods.vue';
import BsTwoFactorScan from '~/components/account/two-factor-scan.vue';

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
    BsTwoFactorMethods,
    BsTwoFactorScan,
    LucideArrowRight: ArrowRight,
    LucideCheck: Check,
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
    :email="email"
    :loading="loading"
    @change-account="$emit('change-account')"
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
    <bs-two-factor-methods v-if="!setup" v-model="method" :email="email" />

    <!-- The authenticator app -->
    <bs-two-factor-scan
      v-if="setup && setup.method === 'totp'"
      :qr-code="setup.qrCode"
      :secret="setup.secret"
    />

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
