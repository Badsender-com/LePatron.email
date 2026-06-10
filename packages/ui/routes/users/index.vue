<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsUsersTable from '~/components/users/table.vue';
import BsPageHeader from '~/components/layout/bs-page-header.vue';

export default {
  name: 'PageUsers',
  components: { BsUsersTable, BsPageHeader },
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $tc('global.user', 2) }}
      </template>
    </bs-page-header>
    <v-container fluid>
      <bs-users-table
        v-model="loading"
        :users="users"
        @update="updateUserFromActions"
      />
    </v-container>
  </div>
</template>
