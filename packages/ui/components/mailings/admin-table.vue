<script>
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import { Mail, Pencil } from 'lucide-vue';

export default {
  name: 'BsMailingsAdminTable',
  components: {
    LucideMail: Mail,
    LucidePencil: Pencil,
  },
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
  props: {
    mailings: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    pagination: { type: Object, default: () => ({}) },
    clickable: { type: Boolean, default: true },
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'right',
          width: '80px',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    tableClasses() {
      return {
        'mailings-table': true,
        'mailings-table--clickable': this.clickable,
      };
    },
  },
  methods: {
    handleItemsPerPageChange(itemsPerPage) {
      this.$emit('update:items-per-page', itemsPerPage);
    },
    openMailing(item) {
      // Mailings live outside the Nuxt application (in /editor)
      window.location.href = `/editor/${item.id}`;
    },
    handleRowClick(item) {
      if (this.clickable) {
        this.openMailing(item);
      }
    },
  },
};
</script>

<template>
  <v-data-table
    :headers="tableHeaders"
    :items="mailings"
    :loading="loading"
    :items-per-page="25"
    :hide-default-footer="
      mailings.length <= $options.TABLE_PAGINATION_THRESHOLD
    "
    :footer-props="$options.TABLE_FOOTER_PROPS"
    :class="tableClasses"
    v-bind="$attrs"
    @update:items-per-page="handleItemsPerPageChange"
    @click:row="handleRowClick"
  >
    <template #item.name="{ item }">
      <span class="font-weight-medium">{{ item.name }}</span>
    </template>

    <template #item.userName="{ item }">
      <span class="text--secondary">{{ item.userName }}</span>
    </template>

    <template #item.templateName="{ item }">
      <span class="text--secondary">{{ item.templateName }}</span>
    </template>

    <template #item.createdAt="{ item }">
      <span class="text--secondary">{{
        item.createdAt | preciseDateTime
      }}</span>
    </template>

    <template #item.updatedAt="{ item }">
      <span class="text--secondary">{{
        item.updatedAt | preciseDateTime
      }}</span>
    </template>

    <template #item.actions="{ item }">
      <v-tooltip bottom>
        <template #activator="{ on, attrs }">
          <v-btn
            icon
            small
            v-bind="attrs"
            v-on="on"
            @click.stop="openMailing(item)"
          >
            <lucide-pencil :size="18" />
          </v-btn>
        </template>
        <span>{{ $t('global.edit') }}</span>
      </v-tooltip>
    </template>

    <template #no-data>
      <div class="text-center pa-6">
        <lucide-mail :size="48" class="grey--text text--lighten-1" />
        <p class="text-body-1 grey--text mt-4">
          {{ $t('mailings.noMailingsAvailable') }}
        </p>
      </div>
    </template>
  </v-data-table>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Styles — LePatron Design System v1.0
   ========================================================================= */

::v-deep .v-data-table thead th {
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(0, 0, 0, 0.6) !important;
  padding: 10px 16px !important;
  background: rgba(0, 0, 0, 0.02) !important;
  height: 40px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
  white-space: nowrap;
  user-select: none;
}

::v-deep .v-data-table tbody tr {
  height: 40px !important;
  cursor: pointer;
  transition: background 0.15s ease-out;
}

::v-deep .v-data-table tbody td {
  padding: 10px 16px !important;
  font-size: 13px !important;
  color: rgba(0, 0, 0, 0.87) !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important;
  height: 40px !important;
  vertical-align: middle;
}

::v-deep .v-data-table tbody tr:last-child td {
  border-bottom: none !important;
}

::v-deep .v-data-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected {
  background: rgba(0, 172, 220, 0.06) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected:hover {
  background: rgba(0, 172, 220, 0.1) !important;
}

::v-deep .v-data-table__empty-wrapper {
  padding: 48px 24px !important;
  text-align: center;
  color: rgba(0, 0, 0, 0.87) !important;
  font-size: 14px !important;
  font-weight: 600 !important;
}

/* Name column - primary color */
::v-deep .v-data-table tbody td:nth-child(1) {
  font-weight: 500 !important;
  color: var(--v-primary-base) !important;
}

/* Author, Template columns - metadata */
::v-deep .v-data-table tbody td:nth-child(2),
::v-deep .v-data-table tbody td:nth-child(3) {
  color: rgba(0, 0, 0, 0.6) !important;
}

/* Date columns - tabular nums */
::v-deep .v-data-table tbody td:nth-child(4),
::v-deep .v-data-table tbody td:nth-child(5) {
  color: rgba(0, 0, 0, 0.7) !important;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

/* Actions column - right aligned */
::v-deep .v-data-table tbody td:last-child {
  text-align: right !important;
  width: 1%;
  white-space: nowrap;
}

::v-deep .v-data-table thead th:last-child {
  text-align: right !important;
  width: 1%;
}

.mailings-table {
  &--clickable {
    ::v-deep tbody tr {
      cursor: pointer;
    }
  }
}
</style>
