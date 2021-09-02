<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import { ERROR_CODES } from '~/helpers/constants/error-codes.js';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { mapMutations } from 'vuex';
import * as acls from '~/helpers/pages-acls.js';
import EmailsGroupForm from '~/components/group/form-emails-group';
import BsGroupMenu from '~/components/group/menu.vue';
import { LIST_EMAILS_GROUPS } from '../../../../../components/group/emails-groups-tab.vue';

export default {
  name: 'PageEditEmailGroup',
  components: { EmailsGroupForm, BsGroupMenu },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_GROUP_ADMIN,
  },
  async asyncData({ params }) {
    const { emailsGroupId } = params;
    try {
      const emailsGroup = LIST_EMAILS_GROUPS.find(
        (emailsGroup) => emailsGroup.id === emailsGroupId
      );
      return {
        emailsGroup,
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
    };
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async updateEmailsGroup(values) {
      try {
        this.isLoading = true;
        const { groupId, emailsGroupId } = this.$route.params;
        console.log({ values, emailsGroupId });
        // TODO Edit the emails group endpoint
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
          color: 'success',
        });

        this.$router.push(`/groups/${groupId}`);
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
  <bs-layout-left-menu>
    <template #menu>
      <bs-group-menu />
    </template>
    <emails-group-form
      v-model="emailsGroup"
      :title="$t('global.editEmailsGroup')"
      :loading="isLoading"
      @submit="updateEmailsGroup"
    />
  </bs-layout-left-menu>
</template>
