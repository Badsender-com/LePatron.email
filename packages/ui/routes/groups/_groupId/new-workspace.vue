<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';

import * as acls from '~/helpers/pages-acls.js';
import WorkspaceForm from '~/components/workspaces/workspace-form';
import BsGroupMenu from '~/components/group/menu.vue';

export default {
  name: 'PageNewWorkspace',
  components: { WorkspaceForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_GROUP_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;

    try {
      const { items: users } = await $axios.$get(
        `/groups/${params?.groupId}/users`
      );

      return {
        users,
        isLoading: false,
      };
    } catch (error) {
      return { isLoading: false, isError: true };
    }
  },
  data() {
    return {
      isLoading: true,
      isError: false,
      users: [],
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createWorkspace(values) {
      const { $axios } = this;
      const groupId = this.$route.params?.groupId;
      try {
        this.isLoading = true;
        const createdWorkspace = await $axios.$post('/workspaces', {
          groupId,
          ...values,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });

        this.$router.push(`/groups/${groupId}/workspace/${createdWorkspace.id}`);

      } catch (error) {
        const errorKey = `global.errors.${ERROR_CODES[error.response?.data] || 'errorOccured'}`;
        this.showSnackbar({
          text: this.$t(errorKey),
          color: 'error',
        });
      } finally {
        this.isLoading = false;
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
    <workspace-form
      :users="users"
      @submit="createWorkspace"
      :isLoading="isLoading"
    />
  </bs-layout-left-menu>
</template>
