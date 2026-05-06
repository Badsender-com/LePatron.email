<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { IS_ADMIN, USER } from '~/store/user';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getProfileForAdmin, getProfileId } from '~/helpers/api-routes';
import { ESP_TYPES } from '~/helpers/constants/esp-type';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsPageHeader from '~/components/layout/BsPageHeader.vue';

export default {
  name: 'PageEditProfile',
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
    let profileData = {};
    try {
      const [profileResponse, groupResponse] = await Promise.all([
        $axios.$get(getProfileForAdmin(params.profileId)),
        $axios.$get(apiRoutes.groupsItem(params)),
      ]);

      const {
        type,
        id,
        name,
        adobeImsUrl,
        adobeBaseUrl,
        apiKey,
        secretKey,
        targetType,
      } = profileResponse.result;

      if (type === ESP_TYPES.SENDINBLUE) {
        const {
          additionalApiData: {
            senderName,
            senderMail,
            replyTo,
            contentSendType,
          },
        } = profileResponse.result;
        profileData = {
          id,
          name,
          apiKey,
          replyTo,
          senderName,
          contentSendType,
          senderMail,
          type,
        };
      }

      if (type === ESP_TYPES.ACTITO) {
        const {
          additionalApiData: {
            senderMail,
            encodingType,
            entity,
            routingEntity,
            contentSendType,
            targetTable,
            replyTo,
            supportedLanguage,
          },
        } = profileResponse.result;
        profileData = {
          id,
          name,
          apiKey,
          replyTo,
          encodingType,
          entity,
          routingEntity,
          targetTable,
          supportedLanguage,
          contentSendType,
          senderMail,
          type,
        };
      }

      if (type === ESP_TYPES.DSC) {
        const {
          additionalApiData: { senderName, senderMail, replyTo, typeCampagne },
        } = profileResponse.result;
        profileData = {
          id,
          name,
          apiKey,
          replyTo,
          senderName,
          senderMail,
          type,
          typeCampagne,
        };
      }

      if (type === ESP_TYPES.ADOBE) {
        profileData = {
          id,
          name,
          adobeImsUrl,
          adobeBaseUrl,
          apiKey,
          secretKey,
          targetType,
          type,
        };
      }

      return {
        profile: profileData,
        group: groupResponse,
      };
    } catch (error) {
      console.error(error);
      return {
        profile: {},
        group: {},
      };
    }
  },
  data() {
    return {
      profile: {},
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
    pageTitle() {
      return this.profile.name || this.$tc('global.profile', 1);
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    async updateProfile(data) {
      const { $axios, $route } = this;
      const { groupId, profileId } = $route.params;
      try {
        this.isLoading = true;
        await $axios.$post(getProfileId(profileId), {
          _company: groupId,
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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
              text: this.$t('forms.profile.errors.update'),
              color: 'error',
            });
          }
          break;
        }
        case 500: {
          const logId = error?.response?.data?.logId;
          let message = this.$t('forms.profile.errors.update');
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
        {{ pageTitle }}
      </template>
      <template v-if="showGroupBadge" #badge>
        <v-chip small outlined color="accent">
          {{ group.name }}
        </v-chip>
      </template>
    </bs-page-header>
    <v-container fluid>
      <profile-form
        :profile="profile"
        :is-loading="isLoading"
        :is-edit="true"
        @submit="updateProfile"
      />
    </v-container>
  </div>
</template>
