<script>
import { mapMutations } from 'vuex';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroup } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import EmailsGroupForm from '~/components/group/form-emails-group';
import BsGroupSettingsNav from '~/components/group/settings-nav.vue';
import BsGroupSettingsPageHeader from '~/components/group/settings-page-header.vue';

export default {
  name: 'PageEditEmailGroup',
  components: {
    EmailsGroupForm,
    BsGroupSettingsNav,
    BsGroupSettingsPageHeader,
  },
  mixins: [mixinSettingsTitle],
  meta: {
    acl: [acls.ACL_ADMIN, acls.ACL_GROUP_ADMIN],
  },
  async asyncData({ params, $axios }) {
    const { emailsGroupId } = params;
    try {
      const [emailsGroupResponse, groupResponse] = await Promise.all([
        $axios.get(getEmailsGroup(emailsGroupId)),
        $axios.$get(apiRoutes.groupsItem(params)),
      ]);
      return {
        emailsGroup: emailsGroupResponse.data,
        group: groupResponse,
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
      emailsGroup: {},
      group: {},
    };
  },
  head() {
    return { title: this.settingsTitle };
  },
  computed: {
    groupId() {
      return this.$route.params.groupId;
    },
    pageTitle() {
      return this.emailsGroup.name || this.$t('global.editEmailsGroup');
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateEmailsGroup(values) {
      const { $axios, $route } = this;
      const { emailsGroupId } = $route.params;
      const { name, emails } = values;

      try {
        this.isLoading = true;

        await $axios.patch(getEmailsGroup(emailsGroupId), {
          name,
          emails,
        });

        // Update local state with new values
        this.emailsGroup = { ...this.emailsGroup, name, emails };

        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });
      } catch (error) {
        const errorKey = `global.errors.${
          ERROR_CODES[error.response?.data] || 'errorOccured'
        }`;
        this.showSnackbar({
          text: this.$t(errorKey),
          color: 'error',
        });
      } finally {
        this.isLoading = false;
      }
    },
    onCancel() {
      this.$router.push(`/groups/${this.groupId}/settings/emails-groups`);
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
        :title="pageTitle"
        :group-name="group.name"
      />
      <emails-group-form
        v-model="emailsGroup"
        :loading="isLoading"
        @submit="updateEmailsGroup"
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
