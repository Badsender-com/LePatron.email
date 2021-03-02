<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import BsWorkspaceForm from "~/components/workspaces/form";

export default {
  name: `bs-page-group-new-workspace`,
  mixins: [mixinPageTitle],
  components: { BsWorkspaceForm, BsGroupMenu },
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      const usersOfGroupResponse = await $axios.$get(apiRoutes.usersByGroupId(params.groupId));
      return { group: groupResponse, usersOfGroup: usersOfGroupResponse };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      usersOfGroup: [],
      group: {},
      loading: false,
      newWorkspace: {
        description: ``,
        name: ``,
      },
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `${this.$tc('global.group', 1)} – ${this.group.name} - ${this.$t(
        'global.newWorkspace'
      )}`;
    },
    groupId() {
      return this.$route.params.groupId;
    },

  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createWorkspace() {
      const { $axios } = this;
      try {
        this.loading = true;
        await $axios.$post(apiRoutes.workspaces(), {
          groupId: this.groupId,
          ...this.newWorkspace,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        // redirect to workspace page on success
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
    <template v-slot:menu>
      <bs-group-menu />
    </template>
    <bs-workspace-form
      :title="$t('global.newWorkspace')"
      v-model="newWorkspace"
      :usersOfGroup="usersOfGroup"
      :loading="loading"
      @submit="createWorkspace"
    />
  </bs-layout-left-menu>
</template>
