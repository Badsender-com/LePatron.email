<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupForm from '~/components/group/form.vue';

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
        hasAccessRight: false,
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
    async createGroup() {
      const { $axios } = this;
      try {
        this.loading = true;
        console.log(this.newGroup);
        const group = await $axios.$post(apiRoutes.groups(), this.newGroup);
        this.$router.push(apiRoutes.groupsItem({ groupId: group.id }));
      } catch (error) {
        console.log(error);
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
          :disabled="loading"
          @submit="createGroup"
        />
      </v-col>
    </v-row>
  </v-container>
</template>
