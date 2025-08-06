<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';

import * as acls from '~/helpers/pages-acls.js';
import ProfileForm from '~/components/profiles/profile-form';
import BsGroupMenu from '~/components/group/menu.vue';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getProfiles } from '~/helpers/api-routes';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: 'PageNewProfile',
  components: { ProfileForm, BsGroupMenu },
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
      )} ${this.group.name} - ${this.$t('global.newProfile')}`;
    },
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
        this.loading = true;
        await $axios.$post(getProfiles(), {
          _company: groupId,
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
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
    <profile-form :title="$t('global.newProfile')" @submit="createProfile" />
  </bs-layout-left-menu>
</template>
