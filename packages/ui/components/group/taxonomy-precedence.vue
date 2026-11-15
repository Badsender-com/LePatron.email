<script>
import { GripVertical } from 'lucide-vue';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { moveItem } from '~/helpers/reorder.js';
import {
  precedenceList,
  precedenceExamples,
} from '~/helpers/taxonomy-tokens.js';

/**
 * Token precedence as a list (ADR-0026): when values of one email carry the
 * same design token, the dimension placed lowest wins. Reordered by drag and
 * drop, or Alt + arrows on a row, saved at once. Emits `saved` and `error`.
 */
export default {
  name: 'BsTaxonomyPrecedence',
  components: { LucideGripVertical: GripVertical },
  mixins: [mixinTaxonomyManage],
  props: {
    dimensions: { type: Array, default: () => [] },
    values: { type: Array, default: () => [] },
  },
  data() {
    return { dragged: null, saving: false };
  },
  computed: {
    rows() {
      return precedenceList({
        dimensions: this.dimensions,
        values: this.values,
      });
    },
    // The order explained on the company's own values.
    examples() {
      return precedenceExamples(this.rows, this.values);
    },
    movable() {
      return this.canManageTaxonomy && !this.saving;
    },
  },
  methods: {
    async move(from, to) {
      if (!this.movable || to < 0 || to >= this.rows.length || to === from) {
        return;
      }
      const names = moveItem(
        this.rows.map((row) => row.name),
        from,
        to
      );
      try {
        this.saving = true;
        await this.$axios.$put(apiRoutes.taxonomyDimensionsPrecedence(), {
          groupId: this.$route.params.groupId,
          names,
        });
        this.$emit('saved');
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.saving = false;
      }
    },
    onDrop(index) {
      const from = this.dragged;
      this.dragged = null;
      if (from !== null) this.move(from, index);
    },
  },
};
</script>

<template>
  <section class="precedence">
    <h2 class="precedence__title">
      {{ $t('taxonomy.workspace.precedence.title') }}
    </h2>
    <p class="text-body-2">{{ $t('taxonomy.workspace.precedence.intro') }}</p>
    <p v-if="!rows.length" class="text-body-2">
      {{ $t('taxonomy.workspace.precedence.none') }}
    </p>
    <ol v-else class="precedence__list">
      <li
        v-for="(row, index) in rows"
        :key="row.name"
        class="precedence__row"
        :class="{ 'precedence__row--top': index === rows.length - 1 }"
        @dragover.prevent
        @drop.prevent="onDrop(index)"
      >
        <span
          v-if="movable"
          class="precedence__grip"
          draggable="true"
          tabindex="0"
          role="button"
          :aria-label="$t('taxonomy.workspace.dragHint')"
          @dragstart="dragged = index"
          @keydown.alt.up.prevent="move(index, index - 1)"
          @keydown.alt.down.prevent="move(index, index + 1)"
        >
          <lucide-grip-vertical :size="16" />
        </span>
        <span class="precedence__rank">{{ index + 1 }}</span>
        <span class="precedence__label">{{ row.label }}</span>
        <span class="precedence__tokens">
          <code v-for="token in row.tokens" :key="token">{{ token }}</code>
        </span>
        <v-chip
          v-if="index === rows.length - 1"
          x-small
          color="accent"
          outlined
        >
          {{ $t('taxonomy.workspace.precedence.wins') }}
        </v-chip>
      </li>
    </ol>
    <ul v-if="examples.length" class="precedence__examples">
      <li v-for="example in examples" :key="example.token">
        <code>{{ example.token }}</code>
        {{
          $t('taxonomy.workspace.precedence.example', {
            winner: `${example.winner.label} (${example.winner.dimension})`,
            winnerValue: example.winner.value,
            loser: `${example.loser.label} (${example.loser.dimension})`,
            loserValue: example.loser.value,
          })
        }}
      </li>
    </ul>
  </section>
</template>

<style lang="scss" scoped>
.precedence {
  max-width: 760px;

  &__title {
    font-size: 18px;
    font-weight: 600;
    color: var(--v-primary-base);
  }

  &__list {
    list-style: none;
    padding: 0;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    background: #fff;
  }

  &__row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--gray-200);

    &:last-child {
      border-bottom: 0;
    }
  }

  &__grip {
    color: var(--gray-500);
    cursor: grab;

    &:focus-visible {
      outline: 2px solid var(--v-accent-base);
      border-radius: 4px;
    }
  }

  &__rank {
    width: 24px;
    height: 24px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
    background: #eef0f3;
    font-size: 12px;
    font-weight: 600;
  }

  &__row--top &__rank {
    background: var(--v-primary-base);
    color: #fff;
  }

  &__label {
    min-width: 120px;
    font-weight: 500;
  }

  &__examples {
    margin: 0;
    padding-left: 18px;
    font-size: 13px;
    color: var(--gray-700);

    li + li {
      margin-top: 4px;
    }
  }

  &__tokens {
    flex: 1;
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }
}
</style>
