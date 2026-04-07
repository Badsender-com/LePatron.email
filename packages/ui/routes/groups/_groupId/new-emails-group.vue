<script>
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroups } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import FormEmailsGroup from '~/components/group/form-emails-group';

const errors = {
  409: 'global.errors.emailsGroupExist',
};

export default {
  name: 'BsPageNewEmailsGroup',
  components: { BsGroupSettingsNav, FormEmailsGroup },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_GROUP_ADMIN],
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
      emailsGroup: {
        emails: '',
        name: '',
      },
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
    async createUser(data) {
      const { $axios } = this;
      try {
        this.loading = true;
        await $axios.$post(getEmailsGroups(), {
          ...data,
        });
        this.showSnackbar({
          text: this.$t('snackbars.created'),
          color: 'success',
        });
        this.$router.push({
          path: `/groups/${this.groupId}`,
          query: { redirectTab: 'emails-groups' },
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t(
            errors[error.statusCode] || 'global.errors.errorOccured'
          ),
          color: 'error',
        });
        console.log(error);
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
      <bs-group-settings-nav :group="group" />
    </template>
    <form-emails-group
      v-model="emailsGroup"
      :title="$t('global.newEmailsGroup')"
      :loading="loading"
      @submit="createUser"
    />
  </bs-layout-left-menu>
</template>
