<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

import * as acls from '~/helpers/pages-acls.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsGroupMenu from '~/components/group/menu.vue';
import { getProfileForAdmin, getProfileId } from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export default {
  name: 'PageEditProfile',
  components: { ProfileForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  async asyncData(nuxtContext) {
    const { $axios, params } = nuxtContext;
    try {
      const profileResponse = await $axios.$get(
        getProfileForAdmin(params.profileId)
      );

      const {
        id,
        name,
        apiKey,
        additionalApiData: { senderName, senderMail, replyTo },
        type,
      } = profileResponse.result;
      return {
        profile: {
          id,
          name,
          apiKey,
          replyTo,
          senderName,
          senderMail,
          type,
        },
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
