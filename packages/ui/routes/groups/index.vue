<script>
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';

export default {
  name: `page-groups`,
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
  },
  head() {
    return { title: this.title };
  },
  data() {
    return { groups: [] };
  },
  computed: {
    title() {
      return this.$tc('global.group', 2);
    },
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: `left`, value: `name` },
        { text: this.$t('global.createdAt'), value: `createdAt` },
        {
          text: this.$t('tableHeaders.groups.downloadWithoutEnclosingFolder'),
          align: `center`,
          value: `downloadMailingWithoutEnclosingFolder`,
        },
        {
          text: this.$t('tableHeaders.groups.cdnDownload'),
          align: `center`,
          value: `downloadMailingWithCdnImages`,
        },
        {
          text: this.$t('tableHeaders.groups.ftpDownload'),
          align: `center`,
          value: `downloadMailingWithFtpImages`,
        },
      ];
    },
  },
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const groupsResponse = await $axios.$get(apiRoutes.groups());
      return { groups: groupsResponse.items };
    } catch (error) {
      console.log(error);
    }
  },
};
</script>

<template>
  <v-container fluid>
    <v-row>
      <v-col cols="12">
        <v-data-table
          :headers="tableHeaders"
          :items="groups"
          class="elevation-1"
        >
          <template v-slot:item.name="{ item }">
            <nuxt-link :to="`/groups/${item.id}`">{{ item.name }}</nuxt-link>
          </template>
          <template v-slot:item.createdAt="{ item }">
            <span>{{ item.createdAt | preciseDateTime }}</span>
          </template>
          <template
            v-slot:item.downloadMailingWithoutEnclosingFolder="{ item }"
          >
            <v-icon v-if="item.downloadMailingWithoutEnclosingFolder"
              >check</v-icon
            >
          </template>
          <template v-slot:item.downloadMailingWithCdnImages="{ item }">
            <v-icon v-if="item.downloadMailingWithCdnImages">check</v-icon>
          </template>
          <template v-slot:item.downloadMailingWithFtpImages="{ item }">
            <v-icon v-if="item.downloadMailingWithFtpImages">check</v-icon>
          </template>
        </v-data-table>
      </v-col>
    </v-row>
    <v-btn color="accent" fixed bottom right fab link nuxt to="/groups/new">
      <v-icon color="secondary">group_add</v-icon>
    </v-btn>
  </v-container>
</template>
