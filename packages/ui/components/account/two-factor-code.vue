<script>
import { mapMutations } from 'vuex';
import { Check, KeyRound, Mail, Smartphone } from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { accountTwoFactor } from '~/helpers/api-routes.js';
import {
  isStepExpired,
  maskEmail,
  twoFactorErrorKey,
} from '~/helpers/two-factor.js';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsAuthCodeField from '~/components/account/auth-code-field.vue';
import BsAuthOption from '~/components/account/auth-option.vue';
import BsSendEmailCode from '~/components/account/send-email-code.vue';

// The step of the code, after a right password (ADR 0008): six digits from
// the member's verification method, or one of their recovery codes. The
// server takes either in the same field: the link only says which one is
// typed.
export default {
  name: 'BsTwoFactorCode',
  components: {
    BsAuthCard,
    BsAuthCodeField,
    BsAuthOption,
    BsSendEmailCode,
    LucideCheck: Check,
    LucideKeyRound: KeyRound,
    LucideMail: Mail,
    LucideSmartphone: Smartphone,
  },
  props: {
    method: { type: String, default: 'totp' },
    email: { type: String, default: '' },
  },
  data() {
    return {
      code: '',
      trustDevice: false,
      loading: false,
      recovery: false,
      error: '',
    };
  },
  computed: {
    description() {
      if (this.recovery) return this.$t('twoFactor.code.hints.recovery');
      return this.$t(`twoFactor.code.hints.${this.method}`, {
        email: maskEmail(this.email),
      });
    },
  },
  watch: {
    code() {
      this.error = '';
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    toggleRecovery() {
      this.recovery = !this.recovery;
      this.code = '';
      this.$nextTick(() => this.$refs.field.focus());
    },
    async submit() {
      if (!this.code) return;
      this.loading = true;
      try {
        const answer = await this.$axios.$post(accountTwoFactor(), {
          code: this.code.replace(/\s/g, ''),
          trustDevice: this.trustDevice,
        });
        this.$emit('answer', answer);
      } catch (error) {
        if (isStepExpired(error)) {
          this.$emit('expired');
          this.showSnackbar({
            text: this.$t(twoFactorErrorKey(error)),
            color: 'error',
          });
          return;
        }
        // The refusal stays on the field, the code selected to be retyped.
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
    class="bs-two-factor-code"
    :title="$t('twoFactor.code.title')"
    :email="email"
    :loading="loading"
    @change-account="$emit('change-account')"
  >
    <template #icon>
      <lucide-key-round v-if="recovery" :size="26" />
      <lucide-mail v-else-if="method === 'email'" :size="26" />
      <lucide-smartphone v-else :size="26" />
    </template>
    <template #description>{{ description }}</template>

    <form id="two-factor-code-form" @submit.prevent="submit">
      <bs-auth-code-field
        ref="field"
        v-model="code"
        :label="
          recovery
            ? $t('twoFactor.code.recoveryLabel')
            : $t('twoFactor.code.label')
        "
        :placeholder="recovery ? 'xxxx-xxxx' : '000 000'"
        :numeric="!recovery"
        :hint="recovery ? $t('twoFactor.code.recoveryHint') : ''"
        :error="error"
      >
        <button type="button" class="bs-auth-link" @click="toggleRecovery">
          {{
            recovery
              ? $t(`twoFactor.code.useMethod.${method}`)
              : $t('twoFactor.code.useRecovery')
          }}
        </button>
        <bs-send-email-code
          v-if="method === 'email'"
          v-show="!recovery"
          @expired="$emit('expired')"
        />
      </bs-auth-code-field>
    </form>
    <bs-auth-option
      v-model="trustDevice"
      :label="$t('twoFactor.code.trustDevice')"
      :hint="$t('twoFactor.code.trustDeviceHint')"
    />

    <template #actions>
      <v-btn
        :loading="loading"
        elevation="0"
        color="accent"
        form="two-factor-code-form"
        type="submit"
      >
        <lucide-check :size="16" class="mr-2" />
        {{ $t('twoFactor.code.submit') }}
      </v-btn>
    </template>
  </bs-auth-card>
</template>
