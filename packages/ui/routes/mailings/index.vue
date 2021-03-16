<script>
import { mapGetters } from 'vuex';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import { mailings } from '~/helpers/api-routes.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
export default {
  name: 'PageMailings',
  components: { WorkspaceTree, MailingsTable, MailingsFilters },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER },
  async asyncData({ $axios, query }) {
    try {
      const mailingsResponse = await $axios.$get(mailings(), {
        params: { workspaceId: query?.wid },
      });
      return {
        mailings: mailingsResponse.items,
        tags: mailingsResponse.meta.tags,
        mailingsIsLoading: false,
        selectedItem: query?.wid,
      };
    } catch (error) {
      return { mailingsIsLoading: false, mailingsIsError: true };
    }
  },
  data: () => ({
    mailingsIsLoading: true,
    mailingsIsError: false,
    selectedItem: '',
    mailings: [],
    tags: [],
  }),

  computed: {
    title() {
      return 'Emails';
    },
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
  },
  watchQuery: ['wid'],
};
</script>

<template>
  <bs-layout-left-menu>
    <template #menu>
      <v-list>
        <v-list-item v-if="isGroupAdmin" nuxt link :to="groupAdminUrl">
          <v-list-item-avatar>
            <v-icon>settings</v-icon>
          </v-list-item-avatar>
          <v-list-item-content>
            <v-list-item-title>
              {{ $t('global.settings') }}
            </v-list-item-title>
          </v-list-item-content>
        </v-list-item>
      </v-list>
      <workspace-tree :selected-item="selectedItem" />
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-filters :tags="tags" />
        <mailings-table :mailings="mailings" />
      </v-skeleton-loader>
    </v-card>
  </bs-layout-left-menu>
</template>
