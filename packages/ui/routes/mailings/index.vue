<script>
import { mapGetters, mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import { mailings, getWorkspace } from '~/helpers/api-routes.js';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import MailingsSelectionActions from '~/routes/mailings/__partials/mailings-selection-actions';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
export default {
  name: 'PageMailings',
  components: {
    WorkspaceTree,
    MailingsTable,
    MailingsFilters,
    MailingsBreadcrumbs,
    MailingsSelectionActions,
  },
  mixins: [mixinPageTitle],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ $axios, query }) {
    try {
      if (query?.wid) {
        const [workspace, mailingsResponse] = await Promise.all([
          $axios.$get(getWorkspace(query?.wid)),
          $axios.$get(mailings(), {
            params: { workspaceId: query?.wid },
          }),
        ]);

        return {
          mailings: mailingsResponse.items,
          tags: mailingsResponse.meta.tags,
          mailingsIsLoading: false,
          workspace,
        };
      }
    } catch (error) {
      return { mailingsIsLoading: false, mailingsIsError: true };
    }
  },
  data: () => ({
    mailingsIsLoading: false,
    mailingsIsError: false,
    mailings: [],
    mailingsSelection: [],
    workspace: {},
    tags: [],
    filterValues: null,
  }),

  computed: {
    filteredMailings() {
      const filterFunction = mailingsHelpers.createFilters(this.filterValues);
      return this.mailings.filter(filterFunction);
    },
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
    hasAccess() {
      return this.workspace?.hasAccess || false;
    },
  },
  watchQuery: ['wid'],
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),

    handleFilterChange(filterValues) {
      this.filterValues = filterValues;
    },
    async fecthData() {
      try {
        if (this.$route.query?.wid) {
          this.mailingsIsLoading = true;
          const [workspace, mailingsResponse] = await Promise.all([
            this.$axios.$get(getWorkspace(this.$route.query?.wid)),
            this.$axios.$get(mailings(), {
              params: { workspaceId: this.$route.query?.wid },
            }),
          ]);

          this.mailings = mailingsResponse.items;
          this.tags = mailingsResponse.meta.tags;
          this.mailingsIsLoading = false;
          this.workspace = workspace;
        }
      } catch (error) {
        this.mailingsIsLoading = false;
        this.mailingsIsError = true;
      }
    },
    async handleUpdateTags(tagsInformations) {
      const { $axios } = this;
      this.loading = true;
      const { tags, selectedMailing } = tagsInformations;
      try {
        await $axios.$put(mailings(), {
          items: [selectedMailing.id],
          tags,
        });
        this.fecthData();
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
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
        <v-list-item class="justify-center">
          <v-btn
            class="my-4 new-mail-button"
            color="primary"
            tile
            :disabled="!hasAccess"
            :to="`/mailings/new?wid=${$route.query.wid}`"
          >
            <v-icon left>
              mdi-plus
            </v-icon>
            {{ $t('global.newMail') }}
          </v-btn>
        </v-list-item>
      </v-list>
      <workspace-tree />
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-breadcrumbs />
        <mailings-selection-actions :mailings-selection="mailingsSelection" />
        <mailings-filters :tags="tags" @change="handleFilterChange" />
        <mailings-table
          v-model="mailingsSelection"
          :mailings="filteredMailings"
          :workspace="workspace"
          :tags="tags"
          @on-refetch="fecthData()"
          @update-tags="handleUpdateTags"
        />
      </v-skeleton-loader>
    </v-card>
  </bs-layout-left-menu>
</template>
<style>
.new-mail-button {
  width: 90%;
}
</style>
