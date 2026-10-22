<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { accountTwoFactor } from '~/helpers/api-routes.js';
import { isStepExpired, twoFactorErrorKey } from '~/helpers/two-factor.js';

// The step of the code, after a right password (ADR 0008): six digits from
// the member's verification method, or one of their recovery codes.
export default {
  name: 'BsTwoFactorCode',
  props: {
    method: { type: String, default: 'totp' },
  },
  data() {
    return { code: '', loading: false };
  },
  computed: {
    hint() {
      return this.$t(`twoFactor.code.hints.${this.method}`);
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async submit() {
      if (!this.code) return;
      this.loading = true;
      try {
        const answer = await this.$axios.$post(accountTwoFactor(), {
          code: this.code,
        });
        this.$emit('answer', answer);
      } catch (error) {
        this.code = '';
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
  <div class="bs-two-factor-code">
    <v-card-text>
      <p class="text-body-2">{{ hint }}</p>
      <v-form id="two-factor-code-form" @submit.prevent="submit">
        <v-text-field
          v-model="code"
          autofocus
          autocomplete="one-time-code"
          :label="$t('twoFactor.code.label')"
          name="code"
          prepend-icon="lock"
          required
        />
      </v-form>
      <p class="text-caption text--secondary mb-0">
        {{ $t('twoFactor.code.recoveryHint') }}
      </p>
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        :loading="loading"
        elevation="0"
        color="accent"
        form="two-factor-code-form"
        type="submit"
      >
        {{ $t('twoFactor.code.submit') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>
