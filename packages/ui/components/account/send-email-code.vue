<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { accountTwoFactorEmailCode } from '~/helpers/api-routes.js';
import { isStepExpired, twoFactorErrorKey } from '~/helpers/two-factor.js';

// Before a new code by email can be asked: the server bounds how many leave
// and answers 429 past it, the link waits this long so nobody reaches it by
// clicking twice.
const COOLDOWN_SECONDS = 30;

// A new code by email (ADR 0008): it replaces the previous one. A link under
// the field of the code, that counts down once a code left.
export default {
  name: 'BsSendEmailCode',
  props: {
    // The first code already left (with the answer to the password, or at
    // the setup's start): the link waits from the start.
    sentOnMount: { type: Boolean, default: false },
  },
  data() {
    return { loading: false, wait: 0, timer: null };
  },
  computed: {
    label() {
      if (this.wait > 0) {
        return this.$t('twoFactor.code.resendIn', { seconds: this.wait });
      }
      return this.$t('twoFactor.code.resend');
    },
  },
  mounted() {
    if (this.sentOnMount) this.countDown();
  },
  beforeDestroy() {
    clearInterval(this.timer);
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    countDown() {
      clearInterval(this.timer);
      this.wait = COOLDOWN_SECONDS;
      this.timer = setInterval(() => {
        this.wait -= 1;
        if (this.wait <= 0) clearInterval(this.timer);
      }, 1000);
    },
    async send() {
      this.loading = true;
      try {
        await this.$axios.$post(accountTwoFactorEmailCode());
        this.showSnackbar({
          text: this.$t('twoFactor.code.sent'),
          color: 'success',
        });
        this.countDown();
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
  <button
    type="button"
    class="bs-auth-link"
    :disabled="loading || wait > 0"
    aria-live="polite"
    @click="send"
  >
    {{ label }}
  </button>
</template>
