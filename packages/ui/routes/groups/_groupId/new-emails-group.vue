<script>
import { mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import { getEmailsGroups } from '~/helpers/api-routes.js';
import BsGroupMenu from '~/components/group/menu.vue';
import FormEmailsGroup from '~/components/group/form-emails-group';

const errors = {
  409: 'global.errors.emailsGroupExist',
};

export default {
  name: 'BsPageNewEmailsGroup',
  components: { BsGroupMenu, FormEmailsGroup },
  mixins: [mixinPageTitle],
  meta: {
    acl: [acls.ACL_GROUP_ADMIN],
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
    return { title: this.title };
  },

  computed: {
    title() {
      return `${this.$tc('global.settings', 1)} : ${this.$tc(
        'global.group',
        1
      )} ${this.group.name} - ${this.$t('global.newEmailsGroup')}`;
    },
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
      <bs-group-menu />
    </template>
    <form-emails-group
      v-model="emailsGroup"
      :title="$t('global.newEmailsGroup')"
      :loading="loading"
      @submit="createUser"
    />
  </bs-layout-left-menu>
</template>
