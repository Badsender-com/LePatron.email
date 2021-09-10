<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

import * as acls from '~/helpers/pages-acls.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsGroupMenu from '~/components/group/menu.vue';
import { getProfileForAdmin, getProfileId } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { ESP_TYPES } from '~/helpers/constants/esp-type';

export default {
  name: 'PageEditProfile',
  components: { ProfileForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    let profileData = {};
    try {
      const profileResponse = await $axios.$get(
        getProfileForAdmin(params.profileId)
      );

      const { type, id, name, apiKey } = profileResponse.result;

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
          targetTable,
          supportedLanguage,
          contentSendType,
          senderMail,
          type,
        };
      }

      console.log({ profileForAdmin: profileData });

      return {
        profile: profileData,
      };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      profile: {},
      loading: false,
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateProfile(data) {
      const { $axios, $route } = this;
      const { groupId, profileId } = $route.params;
      try {
        this.loading = true;
        await $axios.$post(getProfileId(profileId), {
          _company: groupId,
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
        this.$router.push(`/groups/${groupId}`);
      } catch (error) {
        switch (error?.response?.status) {
          case 401:
            this.showSnackbar({
              text: this.$t('forms.profile.errors.apiKey.unauthorized'),
              color: 'error',
            });
            break;
          default:
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
    <profile-form
      :title="
        $t('global.editProfile', {
          name: profile.name,
        })
      "
      :profile="profile"
      @submit="updateProfile"
    />
  </bs-layout-left-menu>
</template>
