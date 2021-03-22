<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import BsUserForm from '~/components/users/form.vue';

export default {
  name: 'BsPageGroupNewUser',
  components: { BsGroupMenu, BsUserForm },
  mixins: [mixinPageTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return { group: groupResponse };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      group: {},
      loading: false,
      newUser: {
        email: '',
        name: '',
        lang: 'fr',
        role: 'regular_user',
      },
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `${this.$tc('global.group', 1)} – ${this.group.name} - ${this.$t(
        'global.newUser'
      )}`;
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createUser() {
      const { $axios } = this;
      try {
        this.loading = true;
        const user = await $axios.$post(apiRoutes.users(), {
          groupId: this.groupId,
          ...this.newUser,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(apiRoutes.usersItem({ userId: user.id }));
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
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <bs-user-form
      v-model="newUser"
      :title="$t('global.newUser')"
      :loading="loading"
      @submit="createUser"
    />
  </bs-layout-left-menu>
</template>
