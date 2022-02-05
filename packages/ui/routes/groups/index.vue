<script>
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import * as apiRoutes from '~/helpers/api-routes.js';
import BsGroupLoading from '~/components/loadingBar';

export default {
  name: 'PageGroups',
  components: {
    BsGroupLoading,
  },
  mixins: [mixinPageTitle],
  meta: {
    acl: acls.ACL_ADMIN,
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
  data() {
    return { groups: [] };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    title() {
      return this.$tc('global.group', 2);
    },
    tableHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        {
          text: this.$t('tableHeaders.groups.downloadWithoutEnclosingFolder'),
          align: 'center',
          value: 'downloadMailingWithoutEnclosingFolder',
        },
        {
          text: this.$t('tableHeaders.groups.status'),
          align: 'center',
          value: 'status',
        },
        {
          text: this.$t('tableHeaders.groups.cdnDownload'),
          align: 'center',
          value: 'downloadMailingWithCdnImages',
        },
        {
          text: this.$t('tableHeaders.groups.ftpDownload'),
          align: 'center',
          value: 'downloadMailingWithFtpImages',
        },
      ];
    },
  },
};
</script>

<template>
  <v-container fluid>
    <client-only>
      <v-row>
        <v-col cols="12">
          <v-data-table :headers="tableHeaders" :items="groups">
            <template #item.name="{ item }">
              <nuxt-link :to="`/groups/${item.id}`">
                {{ item.name }}
              </nuxt-link>
            </template>
            <template #item.createdAt="{ item }">
              <span>{{ item.createdAt | preciseDateTime }}</span>
            </template>
            <template
              #item.downloadMailingWithoutEnclosingFolder="{ item }"
              color="accent"
            >
              <v-icon v-if="item.downloadMailingWithoutEnclosingFolder">
                check
              </v-icon>
            </template>
            <template #item.downloadMailingWithCdnImages="{ item }">
              <v-icon v-if="item.downloadMailingWithCdnImages" color="accent">
                check
              </v-icon>
            </template>
            <template #item.downloadMailingWithFtpImages="{ item }">
              <v-icon v-if="item.downloadMailingWithFtpImages" color="accent">
                check
              </v-icon>
            </template>
          </v-data-table>
        </v-col>
      </v-row>
      <v-btn color="accent" fixed bottom right fab link nuxt to="/groups/new">
        <v-icon> group_add </v-icon>
      </v-btn>
      <bs-group-loading slot="placeholder" />
    </client-only>
  </v-container>
</template>
