<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import ExportProfileForm from '~/components/export-profiles/export-profile-form.vue';
import BsGroupMenu from '~/components/group/menu.vue';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { groupExportProfiles } from '~/helpers/api-routes';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'PageNewExportProfile',
  components: { ExportProfileForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const groupResponse = await $axios.$get(apiRoutes.groupsItem(params));
      return {
        isLoading: false,
        group: groupResponse,
      };
    } catch (error) {
      return { isLoading: false, isError: true };
    }
  },
  data() {
    return {
      group: {},
      loading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return `${this.$tc('global.settings', 1)} : ${this.$tc(
        'global.group',
        1
      )} ${this.group.name} - ${this.$t('exportProfiles.newExportProfile')}`;
    },
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createExportProfile(data) {
      try {
        this.loading = true;
        await this.$axios.$post(groupExportProfiles({ groupId: this.groupId }), data);
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(`/groups/${this.groupId}?redirectTab=group-export-profiles`);
      } catch (error) {
        const errorCode = error?.response?.data?.message;
        if (errorCode === 'EXPORT_PROFILE_NAME_EXISTS') {
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        } else {
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
        }
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
    <export-profile-form
      :title="$t('exportProfiles.newExportProfile')"
      :loading="loading"
      @submit="createExportProfile"
    />
  </bs-layout-left-menu>
</template>
