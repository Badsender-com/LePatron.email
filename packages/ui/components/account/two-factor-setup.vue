<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import {
  accountTwoFactorSetup,
  accountTwoFactorSetupConfirm,
} from '~/helpers/api-routes.js';
import { isStepExpired, twoFactorErrorKey } from '~/helpers/two-factor.js';

// The setup of two-factor authentication, at the sign-in that follows the
// group requiring it (ADR 0008). Nothing is kept until a first code proves
// the method gives the right ones.
export default {
  name: 'BsTwoFactorSetup',
  data() {
    return {
      method: 'totp',
      setup: null,
      code: '',
      trustDevice: false,
      loading: false,
    };
  },
  mounted() {
    this.start();
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
    async confirm() {
      if (!this.code) return;
      this.loading = true;
      try {
        const answer = await this.$axios.$post(accountTwoFactorSetupConfirm(), {
          code: this.code,
          trustDevice: this.trustDevice,
        });
        this.$emit('answer', answer);
      } catch (error) {
        this.code = '';
        this.fail(error);
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <div class="bs-two-factor-setup">
    <v-card-text>
      <p class="text-body-2">{{ $t('twoFactor.setup.intro') }}</p>
      <template v-if="setup && setup.method === 'totp'">
        <p class="text-body-2">{{ $t('twoFactor.setup.scan') }}</p>
        <div class="text-center">
          <img
            :src="setup.qrCode"
            :alt="$t('twoFactor.setup.qrCodeAlt')"
            width="200"
            height="200"
          />
        </div>
        <p class="text-caption text--secondary mb-1">
          {{ $t('twoFactor.setup.manual') }}
        </p>
        <code class="bs-two-factor-setup__secret">{{ setup.secret }}</code>
      </template>
      <v-form
        v-if="setup"
        id="two-factor-setup-form"
        class="mt-4"
        @submit.prevent="confirm"
      >
        <v-text-field
          v-model="code"
          autofocus
          autocomplete="one-time-code"
          :label="$t('twoFactor.code.label')"
          name="code"
          prepend-icon="lock"
          required
        />
        <v-checkbox
          v-model="trustDevice"
          hide-details
          dense
          :label="$t('twoFactor.code.trustDevice')"
        />
      </v-form>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        :loading="loading"
        :disabled="!setup"
        elevation="0"
        color="accent"
        form="two-factor-setup-form"
        type="submit"
      >
        {{ $t('twoFactor.setup.confirm') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>

<style scoped>
.bs-two-factor-setup__secret {
  display: block;
  word-break: break-all;
  text-align: center;
  user-select: all;
}
</style>
