<script>
import { mapMutations } from 'vuex';
import { Check, Copy } from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { groupKey } from '~/helpers/two-factor.js';

// The authenticator app, at the setup (ADR 0008): the QR code beside three
// numbered steps, and the key to type when it cannot be scanned.
export default {
  name: 'BsTwoFactorScan',
  components: { LucideCheck: Check, LucideCopy: Copy },
  props: {
    qrCode: { type: String, required: true },
    secret: { type: String, required: true },
  },
  data() {
    return { copied: false };
  },
  computed: {
    key() {
      return groupKey(this.secret);
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async copyKey() {
      try {
        await navigator.clipboard.writeText(this.secret);
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <div class="bs-two-factor-scan">
    <div class="bs-two-factor-scan__row">
      <img
        :src="qrCode"
        :alt="$t('twoFactor.setup.qrCodeAlt')"
        width="160"
        height="160"
        class="bs-two-factor-scan__qr"
      />
      <ol class="bs-two-factor-scan__steps">
        <li v-for="n in 3" :key="n">
          <span class="bs-two-factor-scan__step-number">{{ n }}</span>
          <span>{{ $t(`twoFactor.setup.scanSteps.${n}`) }}</span>
        </li>
      </ol>
    </div>
    <div class="bs-two-factor-scan__manual">
      <span class="bs-two-factor-scan__legend">
        {{ $t('twoFactor.setup.manual') }}
      </span>
      <div class="bs-two-factor-scan__key">
        <code>{{ key }}</code>
        <v-btn
          small
          outlined
          color="primary"
          :class="{ 'bs-two-factor-scan__copied': copied }"
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
  </div>
</template>

<style lang="scss" scoped>
.bs-two-factor-scan {
  display: flex;
  flex-direction: column;
  gap: 20px;

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

  &__row {
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
      font-family: var(--font-mono);
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
    &__row {
      flex-direction: column;
    }
  }

  // Copied, said in words: --success-ink, readable on white.
  &__copied.v-btn {
    color: var(--success-ink) !important;
  }
}
</style>
