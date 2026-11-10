<script>
import { ArrowRight } from 'lucide-vue';
import {
  reportCounts,
  draftLinks,
  warningValues,
} from '~/helpers/skills-import.js';

// What an import of a skills export did (ADR 0018): how many items each
// outcome holds, the drafts to publish with what to know before publishing
// them, and why an item was skipped or failed.
export default {
  name: 'BsAiSkillsImportReport',
  components: { LucideArrowRight: ArrowRight },
  props: {
    report: { type: Object, required: true },
  },
  computed: {
    // Only the outcomes that happened: "0 skipped" says nothing.
    counts() {
      return Object.fromEntries(
        Object.entries(reportCounts(this.report)).filter(([, n]) => n > 0)
      );
    },
    drafts() {
      return draftLinks(this.report);
    },
  },
  methods: {
    reasonOf(item) {
      const key = `skillsImport.reasons.${item.reason}`;
      return this.$te(key)
        ? this.$t(key)
        : this.$t(`skillsImport.states.${item.reason}`);
    },
    // A failure the server names by its code reads in words.
    messageOf(item) {
      const key = `aiSkills.errors.${item.message}`;
      return this.$te(key) ? this.$t(key) : item.message;
    },
    warningText(warning) {
      return this.$t(
        `skillsImport.warnings.${warning.code}`,
        warningValues(warning, (key) => this.$t(key))
      );
    },
  },
};
</script>

<template>
  <div class="bs-ai-skills-import-report" role="status" aria-live="polite">
    <p class="bs-ai-skills-import-report__counts">
      <span
        v-for="(count, outcome) in counts"
        :key="outcome"
        :class="`bs-ai-skills-import-report__count--${outcome}`"
      >
        {{ $tc(`skillsImport.report.${outcome}`, count, { count }) }}
      </span>
    </p>
    <template v-if="drafts.length">
      <p class="bs-ai-skills-import-report__intro">
        {{ $t('skillsImport.report.publish') }}
      </p>
      <ul class="bs-ai-skills-import-report__items">
        <li
          v-for="draft in drafts"
          :key="draft.to"
          class="bs-ai-skills-import-report__item"
        >
          <nuxt-link :to="draft.to" @click.native="$emit('leave')">
            {{ draft.id }} · v{{ draft.version }}
            <lucide-arrow-right :size="14" />
          </nuxt-link>
          <span
            v-for="warning in draft.warnings"
            :key="warning.code"
            class="bs-ai-skills-import-report__warning"
          >
            {{ warningText(warning) }}
          </span>
        </li>
      </ul>
    </template>
    <p v-else class="bs-ai-skills-import-report__intro">
      {{ $t('skillsImport.report.nothing') }}
    </p>
    <p
      v-for="item in report.failed"
      :key="`failed-${item.kind}-${item.id}`"
      class="bs-ai-skills-import-report__failed"
    >
      {{
        $t('skillsImport.report.failedItem', {
          id: item.id,
          message: messageOf(item),
        })
      }}
    </p>
    <p
      v-for="item in report.skipped"
      :key="`skipped-${item.kind}-${item.id}`"
      class="bs-ai-skills-import-report__skipped"
    >
      {{
        $t('skillsImport.report.skippedItem', {
          id: item.id,
          reason: reasonOf(item),
        })
      }}
    </p>
  </div>
</template>

<style lang="scss" scoped>
.bs-ai-skills-import-report {
  &__counts {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin: 0 0 0.75rem;
    font-weight: 500;
  }

  &__count--failed {
    color: var(--color-error);
  }

  &__intro {
    margin: 0 0 0.75rem;
    font-size: 0.8125rem;
    color: var(--gray-700);
  }

  &__items {
    list-style: none;
    margin: 0;
    padding: 0;
    max-height: 50vh;
    overflow-y: auto;
    border: 1px solid var(--gray-300);
    border-radius: var(--r-md);
  }

  &__item {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0.75rem 1rem;

    & + & {
      border-top: 1px solid var(--gray-200);
    }
  }

  &__warning,
  &__failed,
  &__skipped {
    font-size: 0.8125rem;
  }

  &__warning,
  &__skipped {
    color: var(--gray-800);
  }

  &__failed {
    color: var(--color-error);
  }

  &__failed,
  &__skipped {
    margin: 0.5rem 0 0;
  }
}
</style>
