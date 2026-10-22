<script>
import { mapState } from 'vuex';
import { Lock } from 'lucide-vue';
import BsDataTable from '~/components/data-table/bs-data-table.vue';
import MailingsEmptyState from '~/routes/mailings/__partials/mailings-empty-state.vue';
import { locationPath, locationRoute } from '~/utils/mailing-location.js';
import { FOLDER, SET_PAGINATION } from '~/store/folder.js';
import { SEARCH_MAX_PAGE_SIZE } from '~/utils/mailing-search';

// The emails of every accessible workspace (ADR 0007). It is read, not acted
// on: each row says where its email is and links there, where every action
// is; the row opens the editor when its location's listing would, as a row
// of that listing does, and says it is read only when it would not.
export default {
  name: 'MailingsSearchTable',
  components: { BsDataTable, MailingsEmptyState, LucideLock: Lock },
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
    rowClass(item) {
      return item.hasAccess ? '' : 'mailings-search-table__row--read-only';
    },
    openEditor(item) {
      if (item.hasAccess) {
        window.location.href = `/editor/${item.id}`;
      }
    },
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
    :item-class="rowClass"
    must-sort
    clickable
    class="mailings-search-table"
    @update:options="handleOptionsChange"
    @click:row="openEditor"
  >
    <template #item.name="{ item }">
      <!-- /editor lives outside the Nuxt SPA: a real <a href>, which a
           middle click opens in a new tab. .stop: the row's click is the
           same navigation. -->
      <a
        v-if="item.hasAccess"
        :href="`/editor/${item.id}`"
        class="mailings-search-table__name"
        @click.stop
      >
        {{ item.name }}
      </a>
      <span v-else class="mailings-search-table__name">
        {{ item.name }}
        <v-tooltip bottom>
          <template #activator="{ on, attrs }">
            <span
              class="mailings-search-table__read-only"
              role="img"
              tabindex="0"
              :aria-label="$t('mailings.search.readOnly')"
              v-bind="attrs"
              v-on="on"
            >
              <lucide-lock :size="14" aria-hidden="true" />
            </span>
          </template>
          <span>{{ $t('mailings.search.readOnly') }}</span>
        </v-tooltip>
      </span>
    </template>
    <template #item.location="{ item }">
      <!-- .stop: the location, not the editor the row opens. -->
      <nuxt-link
        v-if="item.location"
        :to="locationRoute(item.location)"
        class="mailings-search-table__location"
        @click.native.stop
      >
        {{ locationPath(item.location) }}
      </nuxt-link>
    </template>
    <template #item.userName="{ item }">
      <span class="text--secondary">{{ item.userName }}</span>
    </template>
    <template #item.templateName="{ item }">
      <span class="text--secondary">{{ item.templateName }}</span>
    </template>
    <template #item.tags="{ item }">
      <span v-for="tag in item.tags" :key="tag" class="tags">{{ tag }}</span>
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
    <template #no-data>
      <mailings-empty-state
        all-workspaces
        @clear-filters="$emit('clear-filters')"
      />
    </template>
  </bs-data-table>
</template>

<style lang="scss" scoped>
// As the folder listing shows its rows (mailings-table.vue): plain dark
// names, underlined in the primary colour on hover, muted secondary columns.
.mailings-search-table {
  &__name,
  &__location {
    color: var(--gray-900);
    text-decoration: none;
  }

  &__name {
    font-weight: 500;
  }

  &__location:hover,
  &__location:focus {
    text-decoration: underline;
    color: var(--v-primary-base);
  }

  &__read-only {
    display: inline-flex;
    vertical-align: middle;
    margin-left: 4px;
    color: var(--gray-600);
  }

  ::v-deep tbody tr:hover a.mailings-search-table__name {
    text-decoration: underline;
    color: var(--v-primary-base);
  }

  ::v-deep tbody tr.mailings-search-table__row--read-only {
    cursor: default;
  }

  // As the folder listing shows them.
  .tags {
    display: inline-flex;
    align-items: center;
    padding: 1px 8px;
    margin-right: 4px;
    border: 1px solid var(--gray-300);
    border-radius: 9999px; // --r-pill
    font-size: 11px;
    font-weight: 500;
    color: var(--gray-600);
    background: #fff;
  }
}
</style>
