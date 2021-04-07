<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';
import { groupsItemUsers, getWorkspace } from '~/helpers/api-routes.js';
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
      const workspace = await $axios.$get(getWorkspace(params?.workspaceId));
      const { items: users } = await $axios.$get(groupsItemUsers(params));

      return {
        workspace,
        groupUsers: users,
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
      groupUsers: [],
      workspace: {},
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateWorkspace(values) {
      const { $axios } = this;
      try {
        this.isLoading = true;
        const { groupId, workspaceId } = this.$route.params;
        await $axios.$put(`/workspaces/${workspaceId}`, {
          ...values,
          groupId,
        });
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });

        this.$router.push(`/groups/${groupId}`);
      } catch (error) {
        const errorKey = `global.errors.${
          ERROR_CODES[error.response?.data] || 'errorOccured'
        }`;
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
      :workspace="workspace"
      :group-users="groupUsers"
      :is-loading="isLoading"
      @submit="updateWorkspace"
    />
  </bs-layout-left-menu>
</template>
