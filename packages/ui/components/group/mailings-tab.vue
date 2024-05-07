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
      pagination: {
        page: 1,
        itemsPerPage: 10,
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
    async fetchMailings() {
      const {
        $axios,
        $route: { params },
        pagination,
      } = this;
      this.loading = true;
      try {
        console.log('fetchMailings', pagination);
        const response = await $axios.$get(
          apiRoutes.groupsItemMailings(params),
          {
            params: { page: pagination.page, limit: pagination.itemsPerPage },
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
      console.log('handleItemsPerPageChange', itemsPerPage);
      this.pagination.page = 1;
      this.pagination.itemsPerPage = itemsPerPage;
    },
  },
};
</script>

<template>
  <v-card flat tile>
    <v-card-text>
      <bs-mailings-admin-table
        :mailings="mailings"
        :loading="loading"
        :options="pagination || {}"
        :footer-props="{
          pagination,
          disablePagination: true,
          prevIcon: 'none',
          nextIcon: 'none',
          itemsPerPageOptions: [5, 10, 15, -1],
        }"
        @update:items-per-page="handleItemsPerPageChange"
      />
      <v-card
        flat
        class="d-flex align-center justify-center mx-auto"
        max-width="22rem"
      >
        <v-pagination
          v-if="pagination.itemsLength > 0"
          v-model="pagination.page"
          :circle="true"
          class="my-4 pagination-custom-style"
          :length="pagination.pageCount"
        />
      </v-card>
    </v-card-text>
  </v-card>
</template>
