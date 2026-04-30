<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsUsersTable from '~/components/users/table.vue';
import BsCompaniesNav from '~/components/group/companies-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';

export default {
  name: 'PageUsers',
  components: { BsUsersTable, BsCompaniesNav, BsGroupSettingsPageHeader },
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
  <bs-layout-left-menu>
    <template #menu>
      <bs-companies-nav />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header :title="$tc('global.user', 2)" />
      <bs-users-table
        v-model="loading"
        :users="users"
        @update="updateUserFromActions"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
