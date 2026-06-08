<script>
import * as apiRoutes from '~/helpers/api-routes.js';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';

export default {
  name: 'BsGroupMailingsTab',
  components: { BsMailingsAdminTable },
  data() {
    return {
      mailings: [],
      loading: false,
      sortBy: 'updatedAt',
      sortDesc: true,
      pagination: {
        page: 1,
        itemsPerPage: 25,
        itemsLength: 0,
        pageCount: 0,
        pageStart: 0,
        pageStop: 0,
      },
    };
  },
  watch: {
    'pagination.page': 'fetchMailings',
    'pagination.itemsPerPage': 'fetchMailings',
  },
  mounted() {
    this.fetchMailings();
  },
  methods: {
    handlePageChange(page) {
      this.pagination.page = page;
    },
    handleOptionsChange(options) {
      const newSortBy = options.sortBy?.[0] || 'updatedAt';
      const newSortDesc = options.sortDesc?.[0] ?? true;
      if (newSortBy !== this.sortBy || newSortDesc !== this.sortDesc) {
        this.sortBy = newSortBy;
        this.sortDesc = newSortDesc;
        this.pagination.page = 1;
        this.fetchMailings();
      }
    },
    async fetchMailings() {
      const {
        $axios,
        $route: { params },
        pagination,
      } = this;
      this.loading = true;
      try {
        const response = await $axios.$get(
          apiRoutes.groupsItemMailings(params),
          {
            params: {
              page: pagination.page,
              limit: pagination.itemsPerPage,
              sortBy: this.sortBy,
              sortDesc: this.sortDesc,
            },
          }
        );
        this.mailings = response.items;
        this.pagination.itemsLength = response.totalItems;
        this.pagination.pageCount = response.totalPages;
        // Calculate the range of items displayed on the current page
        this.pagination.pageStart =
          (this.pagination.page - 1) * this.pagination.itemsPerPage;
        this.pagination.pageStop =
          this.pagination.pageStart + this.pagination.itemsPerPage;
      } catch (error) {
        console.error('Error fetching mailings:', error);
      } finally {
        this.loading = false;
      }
    },
    handleItemsPerPageChange(itemsPerPage) {
      this.pagination.page = 1;
      this.pagination.itemsPerPage = itemsPerPage;
    },
  },
};
</script>

<template>
  <bs-mailings-admin-table
    :mailings="mailings"
    :loading="loading"
    :server-items-length="pagination.itemsLength"
    :page="pagination.page"
    :items-per-page="pagination.itemsPerPage"
    :sort-by="[sortBy]"
    :sort-desc="[sortDesc]"
    must-sort
    @update:page="handlePageChange"
    @update:items-per-page="handleItemsPerPageChange"
    @update:options="handleOptionsChange"
  />
</template>
