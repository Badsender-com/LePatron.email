<script>
import { mapMutations } from 'vuex';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Copy,
  Download,
  KeyRound,
} from 'lucide-vue';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import BsAuthCard from '~/components/account/auth-card.vue';
import BsAuthOption from '~/components/account/auth-option.vue';

// The recovery codes, shown once (ADR 0008): after the setup, and after one
// was used, since a new set replaced them all. The member goes on only once
// they say they noted them.
export default {
  name: 'BsRecoveryCodes',
  components: {
    BsAuthCard,
    BsAuthOption,
    LucideAlertTriangle: AlertTriangle,
    LucideArrowRight: ArrowRight,
    LucideCheck: Check,
    LucideCopy: Copy,
    LucideDownload: Download,
    LucideKeyRound: KeyRound,
  },
  props: {
    codes: { type: Array, required: true },
    // After the setup, the third of its steps; otherwise a code was used.
    afterSetup: { type: Boolean, default: false },
  },
  data() {
    return { noted: false, copied: false };
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
        this.copied = true;
        setTimeout(() => (this.copied = false), 2000);
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
  <bs-auth-card
    class="bs-recovery-codes"
    :eyebrow="afterSetup ? $t('twoFactor.setup.step', { step: 3 }) : ''"
    :title="$t('twoFactor.recoveryCodes.title')"
  >
    <template #icon><lucide-key-round :size="26" /></template>
    <template #description>
      {{
        afterSetup
          ? $t('twoFactor.recoveryCodes.intro')
          : $t('twoFactor.recoveryCodes.introAfterUse')
      }}
    </template>

    <div role="note" class="bs-recovery-codes__warning">
      <lucide-alert-triangle :size="16" />
      <span>
        <strong>{{ $t('twoFactor.recoveryCodes.notShownAgain') }}</strong>
        {{ $t('twoFactor.recoveryCodes.keepThem') }}
      </span>
    </div>

    <ol class="bs-recovery-codes__list">
      <li v-for="(code, index) in codes" :key="code">
        <span class="bs-recovery-codes__number">{{ index + 1 }}</span>
        <code>{{ code }}</code>
      </li>
    </ol>

    <div class="bs-recovery-codes__tools">
      <v-btn
        outlined
        color="primary"
        :class="{ 'bs-recovery-codes__copied': copied }"
        @click="copy"
      >
        <lucide-check v-if="copied" :size="16" class="mr-2" />
        <lucide-copy v-else :size="16" class="mr-2" />
        {{
          copied
            ? $t('twoFactor.recoveryCodes.copied')
            : $t('twoFactor.recoveryCodes.copy')
        }}
      </v-btn>
      <v-btn outlined color="primary" @click="download">
        <lucide-download :size="16" class="mr-2" />
        {{ $t('twoFactor.recoveryCodes.download') }}
      </v-btn>
    </div>

    <bs-auth-option
      v-model="noted"
      :label="$t('twoFactor.recoveryCodes.noted')"
    />

    <template #actions>
      <v-btn
        :disabled="!noted"
        elevation="0"
        color="accent"
        @click="$emit('continue')"
      >
        {{ $t('twoFactor.recoveryCodes.continue') }}
        <lucide-arrow-right :size="16" class="ml-2" />
      </v-btn>
    </template>
  </bs-auth-card>
</template>

<style lang="scss" scoped>
.bs-recovery-codes {
  &__warning {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    padding: 12px 16px;
    border: 1px solid var(--warning-border);
    border-radius: 7px;
    background: var(--tint-warning-soft);
    font-size: 13px;
    line-height: 1.5;

    svg {
      flex-shrink: 0;
      margin-top: 2px;
      color: var(--v-warning-darken2);
    }

    strong {
      font-weight: 600;
    }
  }

  &__list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px 24px;
    margin: 0;
    padding: 16px 20px;
    list-style: none;
    border: 1px solid var(--gray-200);
    border-radius: 7px;
    background: var(--surface-muted);

    li {
      display: flex;
      gap: 10px;
      align-items: baseline;
    }

    code {
      padding: 0;
      background: none;
      color: var(--gray-900);
      font-family: var(--font-mono);
      font-size: 15px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }
  }

  &__number {
    width: 18px;
    color: var(--gray-600);
    font-size: 12px;
    font-variant-numeric: tabular-nums;
    text-align: right;
  }

  &__tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .v-btn {
      text-transform: none;
      letter-spacing: normal;
    }
  }

  // Copied, said in words: --success-ink, readable on white.
  &__copied.v-btn {
    color: var(--success-ink) !important;
  }
}
</style>
