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
      const [userResponse, mailingsResponse] = await Promise.all([
        $axios.$get(apiRoutes.usersItem(params)),
        $axios.$get(apiRoutes.usersItemMailings(params)),
      ]);
      return { user: userResponse, mailings: mailingsResponse.items };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      user: {},
      mailings: [],
      loading: false,
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
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateUser() {
      const { $axios, $route } = this;
      const { params } = $route;
      try {
        this.loading = true;
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
    <v-card class="mt-3">
      <v-card-title>{{ $tc('global.mailing', 2) }}</v-card-title>
      <v-card-text>
        <bs-mailings-admin-table
          :mailings="mailings"
          :hidden-cols="[`userName`]"
        />
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
