<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import WorkspaceForm from '~/components/workspaces/form';
import BsGroupMenu from '~/components/group/menu.vue';

export default {
  name: 'PageGroupNewWorkspace',
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
      group: null,
      usersOfGroup: [],
      // newWorkspace: {
      //   description: '',
      //   name: '',
      // },
    };
  },
  // computed: {
  //   groupId() {
  //     return this.$route.params.groupId;
  //   },
  //   title() {
  //     return `${this.$tc('global.group', 1)} – ${this.group.name} - ${this.$t(
  //       'global.newWorkspace'
  //     )}`;
  //   },
  // },
  // methods: {
  //   ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
  //   async createWorkspace() {
  //     const { $axios } = this;
  //     try {
  //       this.loading = true;
  //       await $axios.$post(apiRoutes.workspacesForCurrentUser(), {
  //         groupId: this.groupId,
  //         ...this.newWorkspace,
  //       });
  //       this.showSnackbar({
  //         text: this.$t('snackbars.created'),
  //         color: 'success',
  //       });
  //       // redirect to workspace edit page on success
  //       this.$router.push('/');
  //     } catch (error) {
  //       this.showSnackbar({
  //         text: this.$t('global.errors.errorOccured'),
  //         color: 'error',
  //       });
  //       console.log(error);
  //     } finally {
  //       this.loading = false;
  //     }
  //   },
  // },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <workspace-form :users="users" @submit="createWorkspace" />
  </bs-layout-left-menu>
</template>
