<script>
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing.js';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import { Check, Pencil, Trash2, FileText } from 'lucide-vue';
import BsRowActions from '~/components/row-actions/BsRowActions.vue';

export default {
  name: 'BsTemplatesTable',
  components: {
    BsDataTable,
    BsRowActions,
    LucideCheck: Check,
  },
  // FileText is used via $options for BsDataTable emptyIcon
  FileText,
  mixins: [mixinCreateMailing],
  model: { prop: 'loading', event: 'update' },
  props: {
    loading: { type: Boolean, default: false },
    templates: { type: Array, default: () => [] },
    hiddenCols: { type: Array, default: () => [] },
  },
  computed: {
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$tc('global.group', 1),
          value: 'group',
          sort: (a, b) => String(b.name).localeCompare(a.name),
        },
        {
          text: this.$t('tableHeaders.templates.markup'),
          value: 'hasMarkup',
          align: 'center',
          class: 'table-column-action',
        },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          sortable: false,
          align: 'center',
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
  },
  methods: {
    goToTemplate(template) {
      this.$router.push(`/templates/${template.id}`);
    },
    deleteItem(item) {
      this.$emit('delete', item);
    },
    /**
     * Build quick actions for a template row
     * Design System: Edit, Delete
     */
    buildQuickActions(item) {
      return [
        {
          key: 'edit',
          icon: Pencil,
          text: 'global.edit',
          onClick: () => this.goToTemplate(item),
        },
        {
          key: 'delete',
          icon: Trash2,
          text: 'global.delete',
          variant: 'danger',
          onClick: () => this.deleteItem(item),
        },
      ];
    },
  },
};
</script>

<template>
  <bs-data-table
    :headers="tableHeaders"
    :items="templates"
    :loading="loading"
    :empty-icon="$options.FileText"
    :empty-message="$t('templates.noTemplates')"
    clickable
    @click:row="goToTemplate"
  >
    <template #item.name="{ item }">
      <nuxt-link
        :to="`/templates/${item.id}`"
        class="cell-link font-weight-medium"
        @click.native.stop
      >
        {{ item.name }}
      </nuxt-link>
    </template>

    <template #item.group="{ item }">
      <nuxt-link
        :to="`/groups/${item.group.id}`"
        class="cell-link"
        @click.native.stop
      >
        {{ item.group.name }}
      </nuxt-link>
    </template>

    <template #item.hasMarkup="{ item }">
      <lucide-check v-if="item.hasMarkup" :size="18" class="accent--text" />
    </template>

    <template #item.actions="{ item }">
      <bs-row-actions :quick-actions="buildQuickActions(item)" />
    </template>
  </bs-data-table>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Styles — LePatron Design System v1.0
   Based on: /tmp/lepatron-design-latest/preview/components-data-table.html
   ========================================================================= */

/* Real <a>/<nuxt-link> on the name + group cells so middle-click opens
   in a new tab. Style has to mimic a plain text cell. */
.cell-link {
  color: inherit;
  text-decoration: none;
  cursor: pointer;
  border-radius: 2px;

  &:hover {
    text-decoration: underline;
    color: var(--v-primary-base);
  }
}

/* Headers */
::v-deep .v-data-table thead th {
  font-size: 11px !important;
  font-weight: 600 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  color: rgba(0, 0, 0, 0.6) !important; // --gray-600
  padding: 10px 16px !important;
  background: rgba(0, 0, 0, 0.02) !important; // --gray-50
  height: 40px !important;
  border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important; // --gray-300
  white-space: nowrap;
  user-select: none;
}

/* Rows */
::v-deep .v-data-table tbody tr {
  height: 40px !important;
  cursor: pointer;
  transition: background 0.15s ease-out;
}

::v-deep .v-data-table tbody td {
  padding: 10px 16px !important;
  font-size: 13px !important;
  color: rgba(0, 0, 0, 0.87) !important; // --gray-900
  border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important; // --gray-200
  height: 40px !important;
  vertical-align: middle;
}

::v-deep .v-data-table tbody tr:last-child td {
  border-bottom: none !important;
}

/* Row states */
::v-deep .v-data-table tbody tr:hover {
  background: rgba(0, 0, 0, 0.02) !important; // --gray-50
}

::v-deep .v-data-table tbody tr.v-data-table__selected {
  background: rgba(0, 172, 220, 0.06) !important;
}

::v-deep .v-data-table tbody tr.v-data-table__selected:hover {
  background: rgba(0, 172, 220, 0.1) !important;
}

/* Empty state */
::v-deep .v-data-table__empty-wrapper {
  padding: 48px 24px !important;
  text-align: center;
  color: rgba(0, 0, 0, 0.87) !important; // --gray-900
  font-size: 14px !important;
  font-weight: 600 !important;
}

/* ========================================================================= */
/* Templates table specific styles */
/* ========================================================================= */

/* Name column (primary identifier) */
::v-deep .v-data-table tbody td:nth-child(1) {
  font-weight: 500 !important;
  color: var(--v-primary-base) !important;
}

/* Group column (muted metadata) */
::v-deep .v-data-table tbody td:nth-child(2) {
  color: rgba(0, 0, 0, 0.6) !important; // --gray-600
}

/* Markup column (centered checkmark) */
::v-deep .v-data-table tbody td:nth-child(3) {
  text-align: center;
  color: rgba(0, 0, 0, 0.54) !important;
}

/* Actions column */
::v-deep .v-data-table tbody td:last-child {
  text-align: right !important;
  width: 1%;
  white-space: nowrap;
}

::v-deep .v-data-table thead th:last-child {
  text-align: right !important;
  width: 1%;
}
</style>
