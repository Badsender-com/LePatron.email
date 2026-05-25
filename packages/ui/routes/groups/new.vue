<script>
import { mapMutations } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupForm from '~/components/group/form.vue';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';

export default {
  name: 'PageNewGroup',
  components: { BsGroupForm },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  data() {
    return {
      loading: false,
      newGroup: {
        name: '',
        downloadMailingWithoutEnclosingFolder: false,
        downloadMailingWithCdnImages: false,
        cdnProtocol: 'http://',
        cdnEndPoint: '',
        cdnButtonLabel: '',
        downloadMailingWithFtpImages: false,
        ftpProtocol: 'sftp',
        ftpHost: '',
        ftpUsername: '',
        ftpPassword: '',
        ftpPort: 22,
        ftpPathOnServer: './',
        ftpEndPoint: '',
        ftpEndPointProtocol: 'http://',
        ftpButtonLabel: '',
        userHasAccessToAllWorkspaces: false,
      },
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$t('global.newGroup');
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    async createGroup() {
      const { $axios } = this;
      try {
        this.loading = true;
        const group = await $axios.$post(apiRoutes.groups(), this.newGroup);
        this.$router.push(apiRoutes.groupsItem({ groupId: group.id }));
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        if (process.env.NODE_ENV === 'development') {
          // eslint-disable-next-line no-console
          console.error('[groups/new] createGroup failed', error);
        }
      } finally {
        this.loading = false;
      }
    },
  },
};
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="8" offset="2">
        <bs-group-form
          v-model="newGroup"
          :is-edit="false"
          :disabled="loading"
          @submit="createGroup"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
