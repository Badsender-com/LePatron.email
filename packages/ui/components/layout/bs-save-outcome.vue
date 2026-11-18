<script>
import { Check } from 'lucide-vue';

// The outcome of saving a setting, read where it was made (design system:
// CompanySettings, "feedback sits on the option, never elsewhere on the page"):
// "Enregistré" with a check, which the page takes away after four seconds, or
// "Modification non enregistrée." with a way to try again. Never a toast.
//
// The live region is always in the page: a screen reader announces what comes
// into it.
export default {
  name: 'BsSaveOutcome',
  components: { LucideCheck: Check },
  props: {
    // 'saved' | 'failed' | null
    outcome: { type: String, default: null },
    // What went wrong, when the page knows: said after the generic sentence.
    detail: { type: String, default: '' },
  },
};
</script>

<template>
  <div class="bs-save-outcome" role="status" aria-live="polite">
    <span
      v-if="outcome === 'saved'"
      class="bs-save-outcome__text bs-save-outcome__text--saved"
    >
      <lucide-check :size="14" aria-hidden="true" />
      {{ $t('global.saveOutcome.saved') }}
    </span>
    <span
      v-else-if="outcome === 'failed'"
      class="bs-save-outcome__text bs-save-outcome__text--failed"
      role="alert"
    >
      {{ $t('global.saveOutcome.failed') }}
      <template v-if="detail">{{ detail }}</template>
      <button type="button" @click="$emit('retry')">
        {{ $t('global.saveOutcome.retry') }}
      </button>
    </span>
  </div>
</template>

<style lang="scss" scoped>
.bs-save-outcome {
  display: flex;
  align-items: center;

  &__text {
    display: inline-flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    font-size: 13px;
    font-weight: 500;

    &--saved {
      color: var(--success-ink);
    }

    &--failed {
      color: var(--danger-ink);

      button {
        text-decoration: underline;
        font-weight: 500;
      }
    }
  }
}
</style>
