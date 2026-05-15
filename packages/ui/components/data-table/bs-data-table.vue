<script>
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';

export default {
  name: 'BsDataTable',
  inheritAttrs: false,
  props: {
    headers: { type: Array, required: true },
    items: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    clickable: { type: Boolean, default: false },
    showSelect: { type: Boolean, default: false },
    value: { type: Array, default: () => [] },
    itemKey: { type: String, default: 'id' },
    paginationThreshold: { type: Number, default: TABLE_PAGINATION_THRESHOLD },
    emptyIcon: { type: [Object, Function], default: null },
    emptyMessage: { type: String, default: '' },
    alwaysShowFooter: { type: Boolean, default: false },
    mustSort: { type: Boolean, default: false },
    sortBy: { type: [String, Array], default: undefined },
    sortDesc: { type: [Boolean, Array], default: undefined },
  },
  computed: {
    footerProps() {
      return {
        ...TABLE_FOOTER_PROPS,
        'items-per-page-all-text': this.$t('global.all'),
      };
    },
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
      const serverTotal = this.$attrs['server-items-length'];
      const count = serverTotal !== undefined ? serverTotal : this.items.length;
      return count <= this.paginationThreshold;
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
    tableListeners() {
      return {
        ...this.$listeners,
        'click:row': this.handleRowClick,
      };
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
      v-bind="$attrs"
      :headers="headers"
      :items="items"
      :item-key="itemKey"
      :hide-default-footer="hideFooter"
      :footer-props="footerProps"
      :show-select="showSelect"
      :must-sort="mustSort"
      :sort-by="sortBy"
      :sort-desc="sortDesc"
      :class="tableClasses"
      v-on="tableListeners"
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
    border: 1px solid var(--gray-300);
    border-radius: 8px;
    overflow: hidden;

    // ── Headers ────────────────────────────────────────────────────────────
    thead th {
      font-size: 11px !important;
      font-weight: 600 !important;
      letter-spacing: 0.04em !important;
      text-transform: uppercase !important;
      color: var(--gray-700) !important;
      padding: 10px 16px !important;
      background: var(--surface-muted) !important;
      height: 40px !important;
      border-bottom: 1px solid var(--gray-300) !important;
      white-space: nowrap;
      user-select: none;
    }

    // ── Rows ───────────────────────────────────────────────────────────────
    tbody tr {
      height: 40px !important;
      transition: background 0.15s ease-out;
    }

    tbody td {
      padding: 10px 16px !important;
      font-size: 13px !important;
      color: var(--gray-900) !important;
      border-bottom: 1px solid var(--gray-200) !important;
      height: 40px !important;
      vertical-align: middle;
    }

    tbody tr:last-child td {
      border-bottom: none !important;
    }

    // Unified hover: light accent blue across every BsDataTable, whether
    // the row is clickable or not (matches the design system reference).
    tbody tr:hover {
      background: var(--accent-tint-hover) !important;
    }

    tbody tr.v-data-table__selected {
      background: var(--accent-tint-selected) !important;
    }

    tbody tr.v-data-table__selected:hover {
      background: var(--accent-tint-selected-hover) !important;
    }

    // ── Clickable rows ─────────────────────────────────────────────────────
    &--clickable tbody tr {
      cursor: pointer;
    }

    // ── Empty state ────────────────────────────────────────────────────────
    &__empty {
      text-align: center;
      padding: 3rem 1.5rem;
    }

    &__empty-icon {
      color: var(--gray-400);
      margin-bottom: 1rem;
    }

    &__empty-message {
      color: var(--gray-700);
      font-size: 0.875rem;
      margin: 0;
    }
  }
}
</style>
