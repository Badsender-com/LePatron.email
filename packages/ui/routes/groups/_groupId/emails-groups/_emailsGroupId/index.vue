<script>
import { mapGetters, mapMutations } from 'vuex';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { IS_ADMIN, USER } from '~/store/user';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import { getEmailsGroup } from '~/helpers/api-routes.js';
import mixinSettingsTitle from '~/helpers/mixins/mixin-settings-title.js';
import EmailsGroupForm from '~/components/group/form-emails-group';
import BsPageHeader from '~/components/layout/bs-page-header.vue';

export default {
  name: 'PageEditEmailGroup',
  components: {
    EmailsGroupForm,
    BsPageHeader,
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
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    groupId() {
      return this.$route.params.groupId;
    },
    pageTitle() {
      return this.emailsGroup.name || this.$t('global.editEmailsGroup');
    },
    showGroupBadge() {
      return this.isAdmin && this.group.name;
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
      <emails-group-form
        v-model="emailsGroup"
        :loading="isLoading"
        @submit="updateEmailsGroup"
      />
    </v-container>
  </div>
</template>
