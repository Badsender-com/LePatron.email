<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getProfiles } from '~/helpers/api-routes';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';

export default {
  name: 'PageNewProfile',
  components: {
    ProfileForm,
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
  },
  mixins: [mixinSettingsTitle],
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
      isLoading: false,
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async createProfile(data) {
      const { $axios, $route } = this;
      const { groupId } = $route.params;
      try {
        this.isLoading = true;
        await $axios.$post(getProfiles(), {
          _company: groupId,
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push(`/groups/${groupId}/settings/profiles`);
      } catch (error) {
        this.handleError(error);
      } finally {
        this.isLoading = false;
      }
    },

    handleError(error) {
      switch (error?.response?.status) {
        case 401:
          this.showSnackbar({
            text: this.$t('forms.profile.errors.apiKey.unauthorized'),
            color: 'error',
          });
          break;
        case 400: {
          const errorCode = error?.response?.data?.message;
          if (errorCode === 'ADOBE_INVALID_CLIENT') {
            this.showSnackbar({
              text: this.$t('forms.profile.errors.invalidClient'),
              color: 'error',
            });
          } else if (errorCode === 'ADOBE_INVALID_SECRET') {
            this.showSnackbar({
              text: this.$t('forms.profile.errors.invalidSecret'),
              color: 'error',
            });
          } else {
            this.showSnackbar({
              text: this.$t('forms.profile.errors.creation'),
              color: 'error',
            });
          }
          break;
        }
        case 500: {
          const logId = error?.response?.data?.logId;
          let message = this.$t('forms.profile.errors.creation');
          message = message.replace('{logId}', logId || 'N/A');
          this.showSnackbar({
            text: message,
            color: 'error',
          });
          break;
        }
        default:
          this.showSnackbar({
            text: this.$t('global.errors.errorOccured'),
            color: 'error',
          });
      }
    },

    onCancel() {
      this.$router.push(`/groups/${this.groupId}/settings/profiles`);
    },
  },
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-settings-nav :group="group" />
    </template>
    <div class="settings-content">
      <bs-group-settings-page-header
        :title="$t('profiles.newProfile')"
        :group-name="group.name"
      />
      <profile-form
        :is-loading="isLoading"
        :is-edit="false"
        @submit="createProfile"
        @cancel="onCancel"
      />
    </div>
  </bs-layout-left-menu>
</template>

<style scoped>
.settings-content {
  padding: 0;
}
</style>
