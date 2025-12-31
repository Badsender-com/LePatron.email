<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import ExportProfileForm from '~/components/export-profiles/export-profile-form.vue';
import BsGroupMenu from '~/components/group/menu.vue';
import { groupExportProfileItem } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'PageEditExportProfile',
  components: { ExportProfileForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const response = await $axios.$get(
        groupExportProfileItem({
          groupId: params.groupId,
          exportProfileId: params.exportProfileId,
        })
      );
      return {
        exportProfile: response.result || response,
      };
    } catch (error) {
      console.log(error);
      return { exportProfile: {}, isError: true };
    }
  },
  data() {
    return {
      exportProfile: {},
      loading: false,
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('exportProfiles.editExportProfile', { name: this.exportProfile.name || '' });
    },
    groupId() {
      return this.$route.params.groupId;
    },
    exportProfileId() {
      return this.$route.params.exportProfileId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateExportProfile(data) {
      try {
        this.loading = true;
        await this.$axios.$put(
          groupExportProfileItem({
            groupId: this.groupId,
            exportProfileId: this.exportProfileId,
          }),
          data
        );
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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
      :title="$t('exportProfiles.editExportProfile', { name: exportProfile.name })"
      :export-profile="exportProfile"
      :loading="loading"
      @submit="updateExportProfile"
    />
  </bs-layout-left-menu>
</template>
