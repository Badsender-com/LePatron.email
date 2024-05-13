<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsMailingsAdminTable from '~/components/mailings/admin-table.vue';
import BsUserMenu from '~/components/user/menu.vue';
import BsUserForm from '~/components/users/form.vue';
import BsUserActions from '~/components/user/actions.vue';

export default {
  name: 'BsPageUser',
  components: { BsUserMenu, BsUserForm, BsMailingsAdminTable, BsUserActions },
  mixins: [mixinPageTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const userResponse = await $axios.$get(apiRoutes.usersItem(params));
      return { user: userResponse };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      user: {},
      mailings: [],
      loading: false,
      isLoadingMailings: false,
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
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `${this.$tc('global.user', 1)} – ${this.user.name}`;
    },
  },
  watch: {
    'pagination.page': 'loadMailings',
    'pagination.itemsPerPage': 'loadMailings',
  },
  mounted() {
    this.loadMailings();
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async loadMailings() {
      this.isLoadingMailings = true;
      try {
        const {
          $axios,
          $route: { params },
        } = this;
        const response = await $axios.$get(
          apiRoutes.usersItemMailings(params),
          {
            params: {
              page: this.pagination.page,
              limit: this.pagination.itemsPerPage,
            },
          }
        );
        this.mailings = response.items;
        this.pagination.itemsLength = response.totalItems;
        this.pagination.pageCount = response.totalPages;
        this.pagination.pageStart =
          (this.pagination.page - 1) * this.pagination.itemsPerPage;
        this.pagination.pageStop =
          this.pagination.pageStart + this.mailings.length;
      } catch (error) {
        console.error('Error fetching mailings for user:', error);
      } finally {
        this.isLoadingMailings = false;
      }
    },
    handleItemsPerPageChange(itemsPerPage) {
      this.pagination.page = 1;
      this.pagination.itemsPerPage = itemsPerPage;
    },
    async updateUser() {
      this.loading = true;
      try {
        const { $axios, $route } = this;
        const { params } = $route;
        await $axios.$put(apiRoutes.usersItem(params), this.user);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.mixinPageTitleUpdateTitle(this.title);
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
      }
    },
    activateUser() {
      this.$refs.userActions.activate(this.user);
    },
    deactivateUser() {
      this.$refs.userActions.deactivate(this.user);
    },
    resetPassword() {
      this.$refs.userActions.resetPassword(this.user);
    },
    sendPassword() {
      this.$refs.userActions.sendPassword(this.user);
    },
    reSendPassword() {
      this.$refs.userActions.resendPassword(this.user);
    },
    updateUserFromActions(updatedUser) {
      this.user = updatedUser;
      this.mixinPageTitleUpdateTitle(this.title);
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-user-menu
        :user="user"
        :loading="loading"
        @activate="activateUser"
        @deactivate="deactivateUser"
        @resetPassword="resetPassword"
        @sendPassword="sendPassword"
        @resendPassword="reSendPassword"
      />
    </template>
    <bs-user-form
      v-model="user"
      :title="$t('users.details')"
      :loading="loading"
      @submit="updateUser"
    />
    <v-card flat tile>
      <v-card-title>{{ $tc('global.mailing', 2) }}</v-card-title>
      <v-card-text>
        <bs-mailings-admin-table
          :mailings="mailings"
          :loading="isLoadingMailings"
          :options="pagination || {}"
          :hidden-cols="[`userName`]"
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
            v-if="pagination && pagination.itemsLength > 0"
            v-model="pagination.page"
            :circle="true"
            class="my-4 pagination-custom-style"
            :length="pagination.pageCount"
          />
        </v-card>
      </v-card-text>
    </v-card>
    <bs-user-actions
      ref="userActions"
      v-model="loading"
      :user="user"
      @update="updateUserFromActions"
    />
  </bs-layout-left-menu>
</template>
