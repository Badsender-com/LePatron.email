<script>
import { mapGetters, mapState } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import { mailings } from '~/helpers/api-routes.js';
import BsMailingsModalNew from '~/routes/mailings/__partials/mailings-new-modal.vue';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import { Plus } from 'lucide-vue';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import MailingsHeader from '~/routes/mailings/__partials/mailings-header';
import MailingsSelectionActions from '~/routes/mailings/__partials/mailings-selection-actions';
import { IS_ADMIN, IS_GROUP_ADMIN, USER } from '~/store/user';
import {
  FOLDER,
  SET_PAGINATION,
  SET_TAGS,
  FETCH_MAILINGS_FOR_WORKSPACE_UPDATE,
  FETCH_MAILINGS_FOR_FILTER_UPDATE,
  FETCH_WORKSPACES,
} from '~/store/folder';
import { TEMPLATE, FETCH_TEMPLATES } from '~/store/template';
import BsGroupLoading from '~/components/loadingBar';
import EmailBuilderPlaceholder from '~/routes/mailings/__partials/email-builder-placeholder';

export default {
  name: 'PageMailings',
  components: {
    WorkspaceTree,
    MailingsTable,
    MailingsFilters,
    MailingsSelectionActions,
    BsMailingsModalNew,
    MailingsHeader,
    BsGroupLoading,
    EmailBuilderPlaceholder,
    LucidePlus: Plus,
  },
  mixins: [mixinPageTitle, mixinCreateMailing, mixinCurrentLocation],
  meta: { acl: ACL_USER },
  middleware({ store, redirect }) {
    if (store.getters[`${USER}/${IS_ADMIN}`]) {
      redirect('/groups');
    }
  },
  async asyncData({ query, store }) {
    await Promise.all([
      store.dispatch(`${FOLDER}/${FETCH_MAILINGS_FOR_WORKSPACE_UPDATE}`, {
        query,
      }),
      store.dispatch(`${FOLDER}/${FETCH_WORKSPACES}`),
      store.dispatch(`${TEMPLATE}/${FETCH_TEMPLATES}`),
    ]);
  },
  data: () => ({
    loading: false,
    mailingsSelection: [],
    filterValues: null,
  }),
  computed: {
    filteredMailings() {
      const filterFunction = mailingsHelpers.createFilters(this.filterValues);
      return this.mailings.filter(filterFunction);
    },
    title() {
      return this.$t('modules.emailBuilder');
    },
    ...mapState(FOLDER, [
      'mailings',
      'tags',
      'isLoadingWorkspaceOrFolder',
      'isLoadingMailingsForWorkspaceUpdate',
      'pagination',
      'filters',
    ]),
    ...mapState(USER, ['hasFtpAccess']),
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
    isEmailBuilderEnabled() {
      // Default to true if not set (backward compatibility)
      const enabled = this.$store.state.user?.info?.group?.enableEmailBuilder;
      return enabled !== false;
    },
    itemsLength() {
      return this.pagination?.itemsLength;
    },
    currentPage: {
      get() {
        return this.pagination.page;
      },
      async set(val) {
        const { commit } = this.$store;
        await commit(`${FOLDER}/${SET_PAGINATION}`, {
          page: val,
        });
        this.fetchMailListingForFilterUpdate({ pagination: { page: val } });
      },
    },
  },
  watch: {
    $route: ['resetMailingsSelection'],
  },
  methods: {
    resetMailingsSelection() {
      this.mailingsSelection = [];
    },
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
    async fetchMailListingForFilterUpdate(additionalParams = {}) {
      const { dispatch } = this.$store;
      await dispatch(`${FOLDER}/${FETCH_MAILINGS_FOR_FILTER_UPDATE}`, {
        query: this.$route.query,
        $t: this.$t || null,
        ...additionalParams,
      });
      this.resetMailingsSelection();
    },
    async fetchMailListingForWorkspaceUpdate(additionalParams = {}) {
      const { dispatch } = this.$store;
      await dispatch(`${FOLDER}/${FETCH_MAILINGS_FOR_WORKSPACE_UPDATE}`, {
        query: this.$route.query,
        $t: this.$t || null,
        ...additionalParams,
      });
    },
    onTagCreate(newTag) {
      this.$store.commit(`${FOLDER}/${SET_TAGS}`, [
        ...new Set([newTag, ...this.tags]),
      ]);
    },
    async onMailSelectionTagsUpdate(tagsUpdates) {
      await this.handleTagsUpdate({
        items: this.mailingsSelection.map((mailing) => mailing.id),
        tags: tagsUpdates,
      });
      this.resetMailingsSelection();
    },
    async onMailTableTagsUpdate(tagsInformations) {
      const { tags, selectedMailing } = tagsInformations;
      await this.handleTagsUpdate({
        items: [selectedMailing.id],
        tags,
      });
    },
    async handleTagsUpdate({ items, tags }) {
      const { $axios } = this;
      this.loading = true;
      try {
        await $axios.$put(mailings(), {
          items,
          tags,
        });
        await this.fetchMailListingForFilterUpdate();
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
    async handleDownloadSingleMail({ mailing, isWithFtp }) {
      this.$refs.mailingSelectionActions.handleInitSingleDownload({
        mailing,
        isWithFtp,
      });
    },
    async refreshLeftMenuData() {
      await this.$refs.workspaceTree.fetchData();
    },
  },
};
</script>

<template>
  <!-- Email Builder disabled: show marketing placeholder -->
  <email-builder-placeholder v-if="!isEmailBuilderEnabled" />

  <!-- Email Builder enabled: show normal UI -->
  <bs-layout-left-menu v-else>
    <template #menu>
      <workspace-tree ref="workspaceTree" />
    </template>
    <v-card flat tile>
      <client-only>
        <v-skeleton-loader
          :loading="
            isLoadingMailingsForWorkspaceUpdate || isLoadingWorkspaceOrFolder
          "
          type="table"
        >
          <mailings-header @on-refresh="refreshLeftMenuData">
            <template #actions>
              <v-btn
                color="accent"
                elevation="0"
                :disabled="!hasAccess"
                @click="openNewMailModal"
              >
                <lucide-plus :size="18" class="mr-1" />
                {{ $t('global.newMail') }}
              </v-btn>
            </template>
          </mailings-header>
          <mailings-filters
            :tags="tags"
            @on-refresh="fetchMailListingForFilterUpdate"
          />
          <mailings-selection-actions
            ref="mailingSelectionActions"
            :mailings-selection="mailingsSelection"
            :tags="tags"
            :has-ftp-access="hasFtpAccess"
            @createTag="onTagCreate"
            @updateTags="onMailSelectionTagsUpdate"
            @on-refetch="fetchMailListingForFilterUpdate"
          />
          <mailings-table
            v-model="mailingsSelection"
            :mailings="filteredMailings"
            :has-ftp-access="hasFtpAccess"
            :tags="tags"
            :current-page="currentPage"
            :items-length="itemsLength"
            @on-single-mail-download="handleDownloadSingleMail"
            @on-refetch="fetchMailListingForFilterUpdate"
            @update-tags="onMailTableTagsUpdate"
            @update:page="currentPage = $event"
          />
        </v-skeleton-loader>
        <bs-group-loading slot="placeholder" />
      </client-only>
    </v-card>
    <bs-mailings-modal-new
      ref="modalNewMailDialog"
      :loading-parent="loading"
      @create-new-mail="handleCreateNewMail"
    />
  </bs-layout-left-menu>
</template>
