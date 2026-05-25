<script>
import { mapGetters, mapMutations } from 'vuex';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import {
  groupsItem,
  groupsItemUsers,
  getWorkspace,
} from '~/helpers/api-routes.js';
import * as acls from '~/helpers/pages-acls.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import WorkspaceForm from '~/components/workspaces/workspace-form';
import BsPageHeader from '~/components/layout/bs-page-header.vue';

export default {
  name: 'PageUpdateWorkspace',
  components: {
    WorkspaceForm,
    BsPageHeader,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const [workspace, groupResponse, usersResponse] = await Promise.all([
        $axios.$get(getWorkspace(params.workspaceId)),
        $axios.$get(groupsItem(params)),
        $axios.$get(groupsItemUsers(params)),
      ]);

      return {
        workspace,
        group: groupResponse,
        groupUsers: usersResponse.items || [],
        isLoading: false,
      };
    } catch (error) {
      return { isLoading: false, isError: true };
    }
  },
  data() {
    return {
      group: {},
      isLoading: false,
      isError: false,
      groupUsers: [],
      workspace: {},
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    groupId() {
      return this.$route.params.groupId;
    },
    workspaceId() {
      return this.$route.params.workspaceId;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateWorkspace(values) {
      try {
        this.isLoading = true;
        await this.$axios.$put(`/workspaces/${this.workspaceId}`, {
          ...values,
          groupId: this.groupId,
        });
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.$router.push(`/groups/${this.groupId}/settings/workspaces`);
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('global.editTeam') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <workspace-form
        :workspace="workspace"
        :group-users="groupUsers"
        :is-loading="isLoading"
        is-edit
        @submit="updateWorkspace"
      />
    </v-container>
  </div>
</template>
