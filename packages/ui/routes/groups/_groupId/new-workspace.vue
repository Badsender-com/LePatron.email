<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
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
    // ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createWorkspace(values) {
      const { $axios } = this;
      try {
        this.loading = true;
        await $axios.$post('/workspaces', {
          groupId: this.$route.params?.groupId,
          ...values,
        });
        // this.showSnackbar({
        //   text: this.$t('snackbars.created'),
        //   color: 'success',
        // });
        // redirect to workspace edit page on success
        this.$router.push('/');
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
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
    <workspace-form :users="users" @submit="createWorkspace" />
  </bs-layout-left-menu>
</template>
