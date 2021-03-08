<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';

import * as acls from '~/helpers/pages-acls.js';
import WorkspaceForm from '~/components/workspaces/workspace-form';
import BsGroupMenu from '~/components/group/menu.vue';

export default {
  name: 'PageUpdateWorkspace',
  components: { WorkspaceForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_GROUP_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;

    try {
     const workspace = await $axios.$get(`/workspaces/${params?.workspaceId}`);
      console.log({workspace})

      return {
        workspace,
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
    async updateWorkspace(values) {
      const { $axios } = this;
      try {
        this.isLoading = true;
        const createdWorkspace = await $axios.$post('/workspaces', {
          groupId: this.$route.params?.groupId,
          ...values,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });

        // TODO: redirect to workspace edit page on success
        this.$router.push({
          path:`/groups/${this.$route.params?.groupId}/edit-workspace`,
          query: { id: createdWorkspace.id },

        });
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
      @submit="updateWorkspace"
      :isLoading="isLoading"
    />
  </bs-layout-left-menu>
</template>
