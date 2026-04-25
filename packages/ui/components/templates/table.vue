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
      <span class="font-weight-medium">{{ item.name }}</span>
    </template>

    <template #item.group="{ item }">
      <nuxt-link :to="`/groups/${item.group.id}`" @click.stop>
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
