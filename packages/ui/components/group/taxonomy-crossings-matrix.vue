<script>
import { Check, Star } from 'lucide-vue';
import mixinTaxonomyManage from '~/helpers/mixins/mixin-taxonomy-manage.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import {
  crossingsMatrix,
  toggleOffered,
  toggleEverywhere,
  toggleDefault,
  changedRows,
  crossingsPayload,
} from '~/helpers/taxonomy-crossings.js';

/**
 * The Crossings segment of a child dimension (ADR-0026), a draft saved at
 * once; the first column and the switch stay in sight. Emits `saved`, `dirty`
 * and `error`.
 */
export default {
  name: 'BsTaxonomyCrossingsMatrix',
  components: { LucideCheck: Check, LucideStar: Star },
  mixins: [mixinTaxonomyManage],
  props: {
    dimension: { type: Object, required: true },
    parent: { type: Object, required: true },
    parentValues: { type: Array, default: () => [] },
    childValues: { type: Array, default: () => [] },
  },
  data() {
    return { initial: null, draft: null, saving: false };
  },
  computed: {
    changes() {
      return this.initial ? changedRows(this.initial, this.draft).length : 0;
    },
    readOnly() {
      return !this.canManageTaxonomy || this.saving;
    },
  },
  watch: {
    parentValues: 'reset',
    childValues: 'reset',
    changes(count) {
      this.$emit('dirty', count > 0);
    },
  },
  created() {
    this.reset();
  },
  methods: {
    reset() {
      this.initial = crossingsMatrix({
        parentValues: this.parentValues,
        childValues: this.childValues,
      });
      this.draft = this.initial;
    },
    tick(rowId, parentId) {
      this.draft = toggleOffered(this.draft, rowId, parentId);
    },
    star(rowId, parentId) {
      this.draft = toggleDefault(this.draft, rowId, parentId);
    },
    everywhere(rowId) {
      this.draft = toggleEverywhere(this.draft, rowId);
    },
    async save() {
      try {
        this.saving = true;
        await this.$axios.$put(apiRoutes.taxonomyItemsCrossings(), {
          groupId: this.$route.params.groupId,
          type: this.dimension.name,
          crossings: crossingsPayload(this.draft),
        });
        this.initial = this.draft;
        this.$emit('saved');
      } catch (error) {
        this.$emit('error', error);
      } finally {
        this.saving = false;
      }
    },
  },
};
</script>

<template>
  <section class="crossings">
    <p class="text-body-2">
      {{
        $t('taxonomy.workspace.crossings.intro', {
          child: dimension.label,
          parent: parent.label,
        })
      }}
    </p>
    <div class="crossings__scroll">
      <table class="crossings__table">
        <thead>
          <tr>
            <th class="crossings__first">{{ dimension.label }}</th>
            <th class="crossings__everywhere">
              {{ $t('taxonomy.workspace.crossings.everywhere') }}
            </th>
            <th v-for="column in draft.columns" :key="column.id">
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in draft.rows" :key="row.id">
            <th scope="row" class="crossings__first">
              {{ row.label }}
            </th>
            <td class="crossings__everywhere">
              <v-switch
                :input-value="row.everywhere"
                :disabled="readOnly"
                :aria-label="
                  $t('taxonomy.workspace.crossings.everywhereOf', {
                    label: row.label,
                  })
                "
                color="accent"
                dense
                hide-details
                class="ma-0"
                @change="everywhere(row.id)"
              />
            </td>
            <td v-for="column in draft.columns" :key="column.id">
              <span class="crossings__cell">
                <button
                  type="button"
                  class="crossings__tick"
                  :class="{
                    'crossings__tick--on': row.cells[column.id].offered,
                  }"
                  :disabled="readOnly"
                  :aria-pressed="String(row.cells[column.id].offered)"
                  :aria-label="`${row.label} · ${column.label}`"
                  @click="tick(row.id, column.id)"
                >
                  <lucide-check
                    v-if="row.cells[column.id].offered"
                    :size="14"
                  />
                </button>
                <button
                  v-if="row.cells[column.id].offered"
                  type="button"
                  class="crossings__star"
                  :class="{
                    'crossings__star--on': row.cells[column.id].isDefault,
                  }"
                  :disabled="readOnly"
                  :aria-pressed="String(row.cells[column.id].isDefault)"
                  :aria-label="
                    $t('taxonomy.workspace.crossings.defaultUnder', {
                      label: row.label,
                      parent: column.label,
                    })
                  "
                  @click="star(row.id, column.id)"
                >
                  <lucide-star :size="14" />
                </button>
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <footer v-if="canManageTaxonomy" class="crossings__footer">
      <span :class="{ 'crossings__changes--on': changes > 0 }">
        {{ $tc('taxonomy.workspace.crossings.changes', changes) }}
      </span>
      <v-spacer />
      <v-btn text :disabled="!changes || saving" @click="reset">
        {{ $t('global.cancel') }}
      </v-btn>
      <v-btn
        color="accent"
        elevation="0"
        :loading="saving"
        :disabled="!changes"
        @click="save"
      >
        {{ $t('taxonomy.workspace.crossings.save') }}
      </v-btn>
    </footer>
  </section>
</template>

<style lang="scss" scoped>
.crossings {
  &__scroll {
    overflow-x: auto;
    border: 1px solid var(--gray-300);
    border-radius: 7px;
    background: #fff;
  }

  &__table {
    border-collapse: separate;
    border-spacing: 0;
    font-size: 13px;

    th,
    td {
      padding: 8px 12px;
      border-bottom: 1px solid var(--gray-200);
      white-space: nowrap;
      text-align: center;
      background: #fff;
    }

    thead th {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--gray-600);
    }
  }

  &__first {
    position: sticky;
    left: 0;
    z-index: 2;
    box-sizing: border-box;
    width: 160px;
    min-width: 160px;
    max-width: 160px;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left !important;
    font-weight: 500;
  }

  &__everywhere {
    position: sticky;
    left: 160px;
    z-index: 2;
    box-shadow: 1px 0 0 var(--gray-300);
  }

  &__cell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  &__tick {
    width: 22px;
    height: 22px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--gray-400);
    border-radius: 4px;
    color: #fff;

    &--on {
      background: var(--v-accent-base);
      border-color: var(--v-accent-base);
    }
  }

  &__star {
    color: var(--gray-500);

    &--on {
      color: var(--warning-ink, #8a5a00);
    }
  }

  &__tick:focus-visible,
  &__star:focus-visible {
    outline: 2px solid var(--v-accent-base);
    outline-offset: 2px;
  }

  &__footer {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 12px;
    font-size: 13px;
    color: var(--gray-600);
  }

  &__changes--on {
    color: var(--v-primary-base);
    font-weight: 600;
  }
}
</style>
