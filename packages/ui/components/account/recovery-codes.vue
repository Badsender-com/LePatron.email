<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

// The recovery codes, shown once (ADR 0008): after the setup, and after one
// was used, since a new set replaced them all. The member goes on only once
// they say they noted them.
export default {
  name: 'BsRecoveryCodes',
  props: {
    codes: { type: Array, required: true },
  },
  data() {
    return { noted: false };
  },
  computed: {
    asText() {
      return this.codes.join('\n');
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async copy() {
      try {
        await navigator.clipboard.writeText(this.asText);
        this.showSnackbar({
          text: this.$t('twoFactor.recoveryCodes.copied'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    download() {
      const blob = new Blob([`${this.asText}\n`], { type: 'text/plain' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'lepatron-recovery-codes.txt';
      link.click();
      URL.revokeObjectURL(link.href);
    },
  },
};
</script>

<template>
  <div class="bs-recovery-codes">
    <v-card-text>
      <p class="text-body-2">{{ $t('twoFactor.recoveryCodes.intro') }}</p>
      <ul class="bs-recovery-codes__list">
        <li v-for="code in codes" :key="code">
          <code>{{ code }}</code>
        </li>
      </ul>
      <div class="d-flex justify-center mb-2">
        <v-btn text color="primary" @click="copy">
          {{ $t('twoFactor.recoveryCodes.copy') }}
        </v-btn>
        <v-btn text color="primary" @click="download">
          {{ $t('twoFactor.recoveryCodes.download') }}
        </v-btn>
      </div>
      <v-checkbox
        v-model="noted"
        hide-details
        :label="$t('twoFactor.recoveryCodes.noted')"
      />
    </v-card-text>
    <v-card-actions>
      <v-spacer />
      <v-btn
        :disabled="!noted"
        elevation="0"
        color="accent"
        @click="$emit('continue')"
      >
        {{ $t('twoFactor.recoveryCodes.continue') }}
      </v-btn>
    </v-card-actions>
  </div>
</template>

<style scoped>
.bs-recovery-codes__list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px 16px;
  padding: 0;
  list-style: none;
  text-align: center;
}
</style>
