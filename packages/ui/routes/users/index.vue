<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsUsersTable from '~/components/users/table.vue';

export default {
  name: 'PageUsers',
  components: { BsUsersTable },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
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
  data() {
    return {
      users: [],
      loading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$tc('global.user', 2);
    },
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
          v-model="loading"
          :users="users"
          @update="updateUserFromActions"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
