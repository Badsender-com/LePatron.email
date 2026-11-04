<script>
import {
  caseOutcome,
  failedCount,
  outputText,
  sideOutcome,
} from '~/helpers/publication-guard.js';

// The cases a publication guard replayed (ADR 0019), each one before and
// after: shared by the guard of one version and the guard of a batch.
export default {
  name: 'BsAiGuardCases',
  props: {
    guard: { type: Object, required: true },
  },
  computed: {
    failed() {
      return failedCount(this.guard);
    },
  },
  methods: {
    caseOutcome,
    outputText,
    sideOutcome,
    sideError(result) {
      return result && result.error
        ? this.$t(`aiSkills.publicationGuard.errors.${result.error}`)
        : '';
    },
  },
};
</script>

<template>
  <div>
    <p class="text-body-2 font-weight-medium mt-4 mb-2">
      <template v-if="guard.cases.length">
        {{
          $t('aiSkills.publicationGuard.summary', {
            cases: guard.cases.length,
            failed,
          })
        }}
      </template>
      <template v-else>{{ $t('aiSkills.publicationGuard.noCase') }}</template>
    </p>
    <div
      v-for="(c, i) in guard.cases"
      :key="`${c.skillId}-${i}`"
      class="guard-case"
    >
      <div class="d-flex align-center mb-2">
        <span class="text-body-2 font-weight-medium">{{ c.name }}</span>
        <span class="text-caption text--secondary ml-2">{{ c.skillId }}</span>
        <v-spacer />
        <v-chip
          v-if="caseOutcome(c) !== 'ok'"
          x-small
          outlined
          color="warning"
        >
          {{
            sideError(c.after) ||
            $t('aiSkills.publicationGuard.errors.OUTPUT_CONTRACT')
          }}
        </v-chip>
        <v-chip
          v-else-if="outputText(c.before) === outputText(c.after)"
          x-small
          outlined
        >
          {{ $t('aiSkills.publicationGuard.same') }}
        </v-chip>
      </div>
      <div class="guard-sides">
        <div
          v-for="side in ['before', 'after']"
          :key="side"
          class="guard-side"
        >
          <div class="text-caption text--secondary mb-1">
            {{ $t(`aiSkills.publicationGuard.${side}`) }}
          </div>
          <p
            v-if="sideOutcome(c[side], c.contract[side]) === 'none'"
            class="text-caption text--secondary mb-0"
          >
            {{ $t('aiSkills.publicationGuard.noBefore') }}
          </p>
          <p
            v-else-if="c[side].error"
            class="text-caption warning--text mb-0"
          >
            {{ sideError(c[side]) }}
          </p>
          <pre v-else class="guard-output">{{ outputText(c[side]) }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.guard-case {
  border: 1px solid var(--v-border-base, rgba(0, 0, 0, 0.12));
  border-radius: 4px;
  padding: 0.75rem;
  margin-bottom: 0.75rem;
}
.guard-sides {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}
.guard-output {
  white-space: pre-wrap;
  word-break: break-word;
  font-size: 0.8125rem;
  margin: 0;
}
</style>
