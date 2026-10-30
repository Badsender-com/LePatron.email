<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { accountTwoFactorEmailCode } from '~/helpers/api-routes.js';
import { isStepExpired, twoFactorErrorKey } from '~/helpers/two-factor.js';

// A new code by email (ADR 0008): it replaces the previous one. The server
// bounds how many leave, and answers 429 past it.
export default {
  name: 'BsSendEmailCode',
  data() {
    return { loading: false };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async send() {
      this.loading = true;
      try {
        await this.$axios.$post(accountTwoFactorEmailCode());
        this.showSnackbar({
          text: this.$t('twoFactor.code.sent'),
          color: 'success',
        });
      } catch (error) {
        if (isStepExpired(error)) this.$emit('expired');
        this.showSnackbar({
          text: this.$t(twoFactorErrorKey(error)),
          color: 'error',
        });
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-btn text small color="primary" :loading="loading" @click="send">
    {{ $t('twoFactor.code.resend') }}
  </v-btn>
</template>
