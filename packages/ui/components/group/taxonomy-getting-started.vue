<script>
import { Plus } from 'lucide-vue';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import { suggestedDimensions } from '~/helpers/taxonomy-suggestions.js';

const STEPS = ['structure', 'values', 'crossings', 'tokens', 'templates'];

/**
 * What a company with no dimension of its own sees first (ADR-0026): the
 * steps of the path, and the usual dimensions, each prefilling the creation
 * without creating anything. Emits `suggest` with a suggestion. Once a
 * dimension exists, the page keeps it while the admin goes on from it, and
 * `dismiss` hides it.
 */
export default {
  name: 'BsTaxonomyGettingStarted',
  components: { LucidePlus: Plus },
  mixins: [mixinTaxonomyManage],
  props: {
    dimensions: { type: Array, default: () => [] },
    // The company has dimensions of its own: the panel can be hidden.
    dismissible: { type: Boolean, default: false },
  },
  computed: {
    steps() {
      return STEPS;
    },
    suggestions() {
      return suggestedDimensions(this.dimensions);
    },
  },
};
</script>

<template>
  <section class="getting-started">
    <h2 class="getting-started__title">
      {{ $t('taxonomy.workspace.start.title') }}
    </h2>
    <p class="text-body-2">{{ $t('taxonomy.workspace.start.intro') }}</p>
    <ol class="getting-started__steps">
      <li v-for="(step, index) in steps" :key="step">
        <span class="getting-started__n">{{ index + 1 }}</span>
        <span>
          <strong>{{
            $t(`taxonomy.workspace.start.steps.${step}.title`)
          }}</strong>
          — {{ $t(`taxonomy.workspace.start.steps.${step}.text`) }}
        </span>
      </li>
    </ol>
    <template v-if="canManageTaxonomy && suggestions.length">
      <p class="getting-started__label">
        {{ $t('taxonomy.workspace.start.suggestionsTitle') }}
      </p>
      <div class="getting-started__suggestions">
        <button
          v-for="suggestion in suggestions"
          :key="suggestion.name"
          type="button"
          class="getting-started__suggestion"
          @click="$emit('suggest', suggestion)"
        >
          <strong>
            <lucide-plus :size="16" />
            {{ $t(suggestion.labelKey) }}
          </strong>
          <code>{{ suggestion.name }}</code>
          <span v-if="suggestion.role" class="getting-started__tag">
            {{ $t(`taxonomy.dimensions.roles.${suggestion.role}`) }}
          </span>
        </button>
      </div>
      <p class="getting-started__hint">
        {{ $t('taxonomy.workspace.start.hint') }}
      </p>
    </template>
    <v-btn
      v-if="dismissible"
      text
      small
      color="primary"
      class="getting-started__dismiss"
      @click="$emit('dismiss')"
    >
      {{ $t('taxonomy.workspace.start.dismiss') }}
    </v-btn>
  </section>
</template>

<style lang="scss" scoped>
.getting-started {
  margin-bottom: 24px;
  padding: 24px;
  border: 1px solid var(--gray-300);
  border-radius: 7px;
  background: #fff;

  &__title {
    font-size: 20px;
    font-weight: 600;
    color: var(--v-primary-base);
  }

  &__steps {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 10px;
    font-size: 13px;

    li {
      display: flex;
      gap: 10px;
      align-items: flex-start;
    }
  }

  &__n {
    flex: none;
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: #eef0f3;
    font-size: 12px;
    font-weight: 600;
  }

  &__label {
    margin: 16px 0 8px;
    font-size: 12px;
    font-weight: 500;
  }

  &__suggestions {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 12px;
  }

  &__suggestion {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    padding: 14px 16px;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    text-align: left;
    transition: border-color 150ms, background-color 150ms;

    &:hover,
    &:focus-visible {
      border-color: var(--v-accent-base);
      background: rgba(0, 172, 220, 0.06);
      outline: none;
    }

    strong {
      display: flex;
      align-items: center;
      gap: 6px;
      color: var(--v-primary-base);
    }
  }

  &__tag {
    font-size: 11px;
    color: var(--gray-700);
  }

  &__hint {
    margin-top: 8px;
    font-size: 12px;
    color: var(--gray-600);
  }
}
</style>
