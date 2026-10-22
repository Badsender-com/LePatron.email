<script>
import { mapState } from 'vuex';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import MailingsEmptyState from '~/routes/mailings/__partials/mailings-empty-state.vue';
import { locationPath, locationRoute } from '~/utils/mailing-location.js';
import {
  FOLDER,
  SET_PAGINATION,
  SEARCH_MAX_PAGE_SIZE,
} from '~/store/folder.js';

// The emails of every accessible workspace (ADR 0007). It is read, not acted
// on: each row says where its email is and links there, where every action
// is; its name opens the editor when its location's listing would.
export default {
  name: 'MailingsSearchTable',
  components: { BsDataTable, MailingsEmptyState },
  ITEMS_PER_PAGE_OPTIONS: [25, 50, SEARCH_MAX_PAGE_SIZE],
  props: {
    mailings: { type: Array, default: () => [] },
    currentPage: { type: Number, default: 1 },
    itemsLength: { type: Number, default: 0 },
  },
  computed: {
    ...mapState(FOLDER, ['pagination', 'isLoadingMailingsForFilterUpdate']),
    headers() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        {
          text: this.$t('mailings.search.location'),
          align: 'left',
          value: 'location',
          sortable: false,
        },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        {
          text: this.$t('global.tags'),
          align: 'left',
          value: 'tags',
          sortable: false,
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
      ];
    },
    itemsPerPage() {
      const size = this.pagination?.itemsPerPage;
      return size > 0 && size <= SEARCH_MAX_PAGE_SIZE ? size : 25;
    },
    sortBy() {
      return Array.isArray(this.pagination?.sortBy)
        ? this.pagination.sortBy
        : [];
    },
    sortDesc() {
      return Array.isArray(this.pagination?.sortDesc)
        ? this.pagination.sortDesc
        : [];
    },
  },
  methods: {
    locationPath,
    locationRoute,
    handleOptionsChange({ page, itemsPerPage, sortBy, sortDesc }) {
      const current = this.pagination || {};
      // Arrays end to end: the server sorts only on arrays.
      const nextSortBy = Array.isArray(sortBy) ? sortBy : [];
      const nextSortDesc = Array.isArray(sortDesc) ? sortDesc : [];
      const sizeChanged = itemsPerPage !== this.itemsPerPage;
      const changed =
        page !== this.currentPage ||
        sizeChanged ||
        nextSortBy[0] !== current.sortBy?.[0] ||
        nextSortDesc[0] !== current.sortDesc?.[0];
      if (!changed) return;

      const targetPage = sizeChanged ? 1 : page;
      this.$store.commit(`${FOLDER}/${SET_PAGINATION}`, {
        page: targetPage,
        itemsPerPage,
        sortBy: nextSortBy,
        sortDesc: nextSortDesc,
      });
      // The page is read back from the store: one reload, not two.
      this.$emit('on-refetch');
    },
  },
};
</script>

<template>
  <bs-data-table
    :headers="headers"
    :items="mailings"
    :loading="isLoadingMailingsForFilterUpdate"
    :server-items-length="itemsLength"
    :page="currentPage"
    :items-per-page="itemsPerPage"
    :sort-by="sortBy"
    :sort-desc="sortDesc"
    :items-per-page-options="$options.ITEMS_PER_PAGE_OPTIONS"
    must-sort
    class="mailings-search-table"
    @update:options="handleOptionsChange"
  >
    <template #item.name="{ item }">
      <!-- /editor lives outside the Nuxt SPA: a real <a href>. -->
      <a
        v-if="item.hasAccess"
        :href="`/editor/${item.id}`"
        class="mailings-search-table__name"
      >
        {{ item.name }}
      </a>
      <span v-else class="mailings-search-table__name">{{ item.name }}</span>
    </template>
    <template #item.location="{ item }">
      <nuxt-link :to="locationRoute(item.location)">
        {{ locationPath(item.location) }}
      </nuxt-link>
    </template>
    <template #item.tags="{ item }">
      <span v-for="tag in item.tags" :key="tag" class="tags">{{ tag }}</span>
    </template>
    <template #item.createdAt="{ item }">
      <span>{{ item.createdAt | preciseDateTime }}</span>
    </template>
    <template #item.updatedAt="{ item }">
      <span>{{ item.updatedAt | preciseDateTime }}</span>
    </template>
    <template #no-data>
      <mailings-empty-state
        all-workspaces
        @clear-filters="$emit('clear-filters')"
      />
    </template>
  </bs-data-table>
</template>

<style lang="scss" scoped>
.mailings-search-table {
  &__name {
    font-weight: 500;
  }

  // As the folder listing shows them.
  .tags {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    margin-right: 4px;
    border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
    border-radius: 9999px; // --r-pill
    font-size: 11px;
    font-weight: 500;
    color: rgba(0, 0, 0, 0.54); // --gray-700
    background: #fff;
  }
}
</style>
