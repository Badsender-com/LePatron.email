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
          align: 'center',
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
    :hide-default-footer="mailings.length <= $options.TABLE_PAGINATION_THRESHOLD"
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
      <span class="text--secondary">{{ item.createdAt | preciseDateTime }}</span>
    </template>

    <template #item.updatedAt="{ item }">
      <span class="text--secondary">{{ item.updatedAt | preciseDateTime }}</span>
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
.mailings-table {
  &--clickable {
    ::v-deep tbody tr {
      cursor: pointer;

      &:hover {
        background-color: rgba(0, 172, 220, 0.05) !important;
      }
    }
  }
}
</style>
