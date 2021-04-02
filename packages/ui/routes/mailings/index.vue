<script>
import { mapGetters } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import {
  getFolder,
  getFolderAccess,
  getWorkspace,
  getWorkspaceAccess,
  mailings,
} from '~/helpers/api-routes.js';
import BsMailingsModalNew from '~/routes/mailings/__partials/mailings-new-modal.vue';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import MailingsHeader from '~/routes/mailings/__partials/mailings-header';
import MailingsSelectionActions from '~/routes/mailings/__partials/mailings-selection-actions';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
export default {
  name: 'PageMailings',
  components: {
    WorkspaceTree,
    MailingsTable,
    MailingsFilters,
    MailingsSelectionActions,
    BsMailingsModalNew,
    MailingsHeader,
  },
  mixins: [mixinPageTitle, mixinCreateMailing, mixinCurrentLocation],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ $axios, query }) {
    try {
      if (!!query?.wid || !!query?.fid) {
        let folder;
        let workspace;
        let hasAccess;

        if (query?.wid || query?.fid) {
          if (query?.fid) {
            const [folderData, hasAccessData] = await Promise.all([
              $axios.$get(getFolder(query?.fid)),
              $axios.$get(getFolderAccess(query?.fid)),
            ]);
            folder = folderData;
            hasAccess = hasAccessData?.hasAccess;
            workspace = null;
          } else if (query?.wid) {
            const [workspaceData, hasAccessData] = await Promise.all([
              $axios.$get(getWorkspace(query?.wid)),
              $axios.$get(getWorkspaceAccess(query?.wid)),
            ]);
            workspace = workspaceData;
            hasAccess = hasAccessData?.hasAccess;
            folder = null;
          }
        }

        const queryMailing = folder
          ? { parentFolderId: query?.fid }
          : { workspaceId: query?.wid };

        const mailingsResponse = await $axios.$get(mailings(), {
          params: queryMailing,
        });

        return {
          mailings: mailingsResponse?.items,
          tags: mailingsResponse.meta?.tags,
          loading: false,
          mailingsIsLoading: false,
          folder,
          workspace,
          hasAccess,
        };
      }
    } catch (error) {
      return { mailingsIsLoading: false, mailingsIsError: true };
    }
  },
  data: () => ({
    mailingsIsLoading: false,
    mailingsIsError: false,
    loading: false,
    mailings: [],
    mailingsSelection: [],
    workspace: {},
    tags: [],
    filterValues: null,
    hasAccess: false,
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
  },
  watchQuery: ['wid', 'fid'],
  methods: {
    openNewMailModal() {
      this.$refs.modalNewMailDialog.open();
    },
    handleFilterChange(filterValues) {
      this.filterValues = filterValues;
    },
    async handleCreateNewMail(createMailModalData) {
      this.loading = true;
      await this.mixinCreateMailing(
        createMailModalData.template,
        'loading',
        createMailModalData.defaultMailName,
        this.currentLocationParam
      );
      this.loading = false;
    },
    async fetchData() {
      await Promise.all([
        this.getFolderAndWorkspaceData(this.$axios, this.$route?.query),
        this.fetchMailListingData(),
      ]);
    },
    async fetchMailListingData() {
      try {
        if (this.$route.query?.wid || this.$route.query?.fid) {
          this.mailingsIsLoading = true;
          const mailingsResponse = await this.$axios.$get(mailings(), {
            params: this.currentLocationParam,
          });

          this.mailings = mailingsResponse.items;
          this.tags = mailingsResponse.meta.tags;
          this.mailingsIsLoading = false;
        }
      } catch (error) {
        this.mailingsIsLoading = false;
        this.mailingsIsError = true;
      } finally {
        this.mailingsSelection = [];
      }
    },
    onTagCreate(newTag) {
      this.tags = [...new Set([newTag, ...this.tags])];
    },
    async onTagsUpdate(tagsUpdates) {
      const { $axios } = this;
      this.loading = true;
      try {
        const mailingsResponse = await $axios.$put(mailings(), {
          items: this.mailingsSelection.map((mailing) => mailing.id),
          tags: tagsUpdates,
        });
        this.tags = mailingsResponse.meta.tags;
        this.showSnackbar({
          text: this.$t('mailings.editTagsSuccessful'),
          color: 'success',
        });
        await this.fetchData();
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
    async handleUpdateTags(tagsInformations) {
      const { $axios } = this;
      this.loading = true;
      const { tags, selectedMailing } = tagsInformations;
      try {
        await $axios.$put(mailings(), {
          items: [selectedMailing.id],
          tags,
        });
        await this.fetchMailListingData();
        this.showSnackbar({
          text: this.$t('mailings.editTagsSuccessful'),
          color: 'success',
        });
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
    async refreshLeftMenuData() {
      await this.$refs.workspaceTree.fetchData();
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
            @click="openNewMailModal"
          >
            <v-icon left>
              mdi-plus
            </v-icon>
            {{ $t('global.newMail') }}
          </v-btn>
        </v-list-item>
      </v-list>
      <div class="list-container">
        <workspace-tree ref="workspaceTree" :mailings="mailings"/>
      </div>
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-header @on-refresh="refreshLeftMenuData" />
        <mailings-selection-actions
          :mailings-selection="mailingsSelection"
          :tags="tags"
          @createTag="onTagCreate"
          @updateTags="onTagsUpdate"
          @on-refetch="fetchMailListingData()"
        />
        <mailings-filters :tags="tags" @change="handleFilterChange" />
        <mailings-table
          v-model="mailingsSelection"
          :mailings="filteredMailings"
          :tags="tags"
          @on-refetch="fetchMailListingData()"
          @update-tags="handleUpdateTags"
        />
      </v-skeleton-loader>
    </v-card>
    <bs-mailings-modal-new
      ref="modalNewMailDialog"
      :loading-parent="loading"
      @create-new-mail="handleCreateNewMail"
    />
  </bs-layout-left-menu>
</template>
<style>
.new-mail-button {
  width: 90%;
  float: right;
}
.list-container {
  overflow-y: auto;
  max-height: calc(100vh - 13rem);
}
</style>
