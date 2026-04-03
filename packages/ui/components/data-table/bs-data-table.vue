<script>
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';

/**
 * BsDataTable - Standardized data table component
 *
 * A wrapper around v-data-table that provides consistent styling and behavior
 * across the application. Features include:
 * - Standardized pagination options (25, 50, 100, All)
 * - Auto-hide footer when items <= threshold
 * - Clickable rows with hover effect (optional)
 * - Consistent empty state styling
 * - Loading skeleton
 *
 * @example Basic usage
 * <bs-data-table
 *   :headers="headers"
 *   :items="items"
 *   :loading="loading"
 * />
 *
 * @example With clickable rows
 * <bs-data-table
 *   :headers="headers"
 *   :items="items"
 *   clickable
 *   @click:row="handleRowClick"
 * />
 *
 * @example With custom empty state
 * <bs-data-table :headers="headers" :items="items">
 *   <template #empty>
 *     <my-custom-empty-state />
 *   </template>
 * </bs-data-table>
 */
export default {
  name: 'BsDataTable',
  props: {
    /**
     * Array of header objects defining table columns
     * @type {Array<{text: string, value: string, align?: string, sortable?: boolean}>}
     */
    headers: { type: Array, required: true },

    /**
     * Array of items to display in the table
     */
    items: { type: Array, default: () => [] },

    /**
     * Loading state - shows skeleton loader when true
     */
    loading: { type: Boolean, default: false },

    /**
     * Makes rows clickable with hover effect
     */
    clickable: { type: Boolean, default: false },

    /**
     * Show row selection checkboxes
     */
    showSelect: { type: Boolean, default: false },

    /**
     * Selected items (for v-model with show-select)
     */
    value: { type: Array, default: () => [] },

    /**
     * Unique key for each item
     */
    itemKey: { type: String, default: 'id' },

    /**
     * Custom threshold for hiding footer (defaults to TABLE_PAGINATION_THRESHOLD)
     */
    paginationThreshold: { type: Number, default: TABLE_PAGINATION_THRESHOLD },

    /**
     * Icon component for empty state
     */
    emptyIcon: { type: [Object, Function], default: null },

    /**
     * Message to show when table is empty
     */
    emptyMessage: { type: String, default: '' },

    /**
     * Force show footer even when items <= threshold
     */
    alwaysShowFooter: { type: Boolean, default: false },

    /**
     * Must sort - requires at least one column to be sorted
     */
    mustSort: { type: Boolean, default: false },

    /**
     * Custom sort-by value
     */
    sortBy: { type: [String, Array], default: undefined },

    /**
     * Sort descending
     */
    sortDesc: { type: [Boolean, Array], default: undefined },
  },
  data() {
    return {
      TABLE_FOOTER_PROPS,
    };
  },
  computed: {
    selectedItems: {
      get() {
        return this.value;
      },
      set(val) {
        this.$emit('input', val);
      },
    },
    hideFooter() {
      if (this.alwaysShowFooter) return false;
      return this.items.length <= this.paginationThreshold;
    },
    tableClasses() {
      return {
        'bs-data-table': true,
        'bs-data-table--clickable': this.clickable,
      };
    },
    defaultEmptyMessage() {
      return this.emptyMessage || this.$t('global.noData');
    },
  },
  methods: {
    handleRowClick(item, row) {
      if (this.clickable) {
        this.$emit('click:row', item, row);
      }
    },
  },
};
</script>

<template>
  <div class="bs-data-table-wrapper">
    <v-skeleton-loader v-if="loading" type="table" />

    <v-data-table
      v-else
      v-model="selectedItems"
      :headers="headers"
      :items="items"
      :item-key="itemKey"
      :hide-default-footer="hideFooter"
      :footer-props="TABLE_FOOTER_PROPS"
      :show-select="showSelect"
      :must-sort="mustSort"
      :sort-by="sortBy"
      :sort-desc="sortDesc"
      :class="tableClasses"
      @click:row="handleRowClick"
    >
      <!-- Pass through all slots -->
      <template v-for="(_, slot) in $scopedSlots" #[slot]="scope">
        <slot :name="slot" v-bind="scope" />
      </template>

      <!-- Default empty state if no custom slot provided -->
      <template v-if="!$scopedSlots['no-data']" #no-data>
        <slot name="empty">
          <div class="bs-data-table__empty">
            <component
              :is="emptyIcon"
              v-if="emptyIcon"
              :size="48"
              class="bs-data-table__empty-icon"
            />
            <p class="bs-data-table__empty-message">
              {{ defaultEmptyMessage }}
            </p>
          </div>
        </slot>
      </template>
    </v-data-table>
  </div>
</template>

<style lang="scss">
.bs-data-table-wrapper {
  .bs-data-table {
    // Clickable rows
    &--clickable {
      tbody tr {
        cursor: pointer;

        &:hover {
          background-color: rgba(0, 172, 220, 0.05) !important;
        }
      }
    }

    // Empty state
    &__empty {
      text-align: center;
      padding: 3rem 1.5rem;
    }

    &__empty-icon {
      color: rgba(0, 0, 0, 0.26);
      margin-bottom: 1rem;
    }

    &__empty-message {
      color: rgba(0, 0, 0, 0.6);
      font-size: 0.875rem;
      margin: 0;
    }
  }
}
</style>
