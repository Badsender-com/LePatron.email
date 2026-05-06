<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { IS_ADMIN, USER } from '~/store/user';
import { getProfiles } from '~/helpers/api-routes';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';

export default {
  name: 'PageNewProfile',
  components: {
    ProfileForm,
    BsPageHeader,
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
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    groupId() {
      return this.$route.params.groupId;
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
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
  <div>
    <bs-page-header
      :show-mobile-menu="true"
      @toggle-mobile-menu="$root.$emit('toggle-mobile-menu')"
    >
      <template #title>
        {{ $t('profiles.newProfile') }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <profile-form
        :is-loading="isLoading"
        :is-edit="false"
        @submit="createProfile"
        @cancel="onCancel"
      />
    </v-container>
  </div>
</template>
