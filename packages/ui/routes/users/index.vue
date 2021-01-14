<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import * as userStatusHelpers from '~/helpers/user-status.js';
import BsUsersTable from '~/components/users/table.vue';

export default {
  name: `page-users`,
  components: { BsUsersTable },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  head() {
    return { title: this.title };
  },
  data() {
    return {
      users: [],
      loading: false,
    };
  },
  computed: {
    title() {
      return this.$tc('global.user', 2);
    },
  },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const usersResponse = await $axios.$get(apiRoutes.users());
      return { users: usersResponse.items };
    } catch (error) {
      console.log(error);
    }
  },
  methods: {
    updateUserFromActions(updatedUser) {
      const userIndex = this.users.findIndex(
        (user) => user.id === updatedUser.id
      );
      this.$set(this.users, userIndex, updatedUser);
    },
  },
};
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <bs-users-table
          :users="users"
          @update="updateUserFromActions"
          v-model="loading"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
