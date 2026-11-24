<script>
import { tokensOfDimension } from '~/helpers/taxonomy-tokens.js';

/**
 * The Tokens segment of a dimension: the design tokens its values carry, and
 * the value each one gives. Set in each value's panel; their typing comes with
 * its own epic (ADR-0026).
 */
export default {
  name: 'BsTaxonomyDimensionTokens',
  props: {
    dimension: { type: Object, required: true },
    values: { type: Array, default: () => [] },
  },
  computed: {
    tokens() {
      return tokensOfDimension(this.dimension.name, this.values);
    },
  },
};
</script>

<template>
  <section class="dimension-tokens">
    <p class="text-body-2">
      {{ $t('taxonomy.workspace.tokens.intro', { label: dimension.label }) }}
    </p>
    <p v-if="!tokens.length" class="dimension-tokens__empty">
      {{ $t('taxonomy.workspace.tokens.none', { label: dimension.label }) }}
    </p>
    <table v-else class="dimension-tokens__table">
      <thead>
        <tr>
          <th>{{ $t('taxonomy.workspace.tokens.token') }}</th>
          <th>{{ $t('taxonomy.workspace.tokens.carriedBy') }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="entry in tokens" :key="entry.token">
          <td>
            <code>{{ entry.token }}</code>
          </td>
          <td>
            <span
              v-for="carrier in entry.carriedBy"
              :key="carrier.label"
              class="dimension-tokens__carrier"
            >
              {{ carrier.label }} · <code>{{ carrier.value }}</code>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
    <p class="dimension-tokens__hint">
      {{ $t('taxonomy.workspace.tokens.hint') }}
    </p>
  </section>
</template>

<style lang="scss" scoped>
.dimension-tokens {
  max-width: 860px;

  &__empty,
  &__hint {
    font-size: 12px;
    color: var(--gray-600);
  }

  &__table {
    width: 100%;
    border-collapse: collapse;
    border: 1px solid var(--gray-300);
    background: #fff;
    font-size: 13px;

    th,
    td {
      padding: 10px 16px;
      border-bottom: 1px solid var(--gray-200);
      text-align: left;
      vertical-align: top;
    }

    th {
      font-size: 11px;
      text-transform: uppercase;
      color: var(--gray-600);
    }
  }

  &__carrier {
    display: inline-block;
    margin: 0 12px 4px 0;
  }
}
</style>
