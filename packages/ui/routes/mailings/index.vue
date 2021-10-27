<script>
import { mapGetters, mapState } from 'vuex';
import mixinPageTitle from '~/helpers/mixins/mixin-page-title.js';
import mixinCreateMailing from '~/helpers/mixins/mixin-create-mailing';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import { mailings } from '~/helpers/api-routes.js';
import BsMailingsModalNew from '~/routes/mailings/__partials/mailings-new-modal.vue';
import { ACL_USER } from '~/helpers/pages-acls.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import WorkspaceTree from '~/routes/mailings/__partials/workspace-tree';
import MailingsTable from '~/routes/mailings/__partials/mailings-table';
import MailingsFilters from '~/routes/mailings/__partials/mailings-filters';
import MailingsHeader from '~/routes/mailings/__partials/mailings-header';
import MailingsSelectionActions from '~/routes/mailings/__partials/mailings-selection-actions';
import { IS_ADMIN, IS_GROUP_ADMIN, USER, HAS_FTP_ACCESS } from '~/store/user';
import { FOLDER, FETCH_MAILINGS } from '~/store/folder';

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
  async asyncData({ query, store }) {
    await store.dispatch(`${FOLDER}/${FETCH_MAILINGS}`, {
      query,
    });
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
      return 'Emails';
    },
    ...mapState(FOLDER, ['mailings', 'tags', 'mailingsIsLoading']),
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
      hasFtpAccess: HAS_FTP_ACCESS,
    }),
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
  },
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
    async fetchMailListingData() {
      const { dispatch } = this.$store;
      await dispatch(`${FOLDER}/${FETCH_MAILINGS}`, {
        query: this.$route.query,
        $t: this.$t,
      });
    },
    onTagCreate(newTag) {
      this.tags = [...new Set([newTag, ...this.tags])];
    },
    async onMailSelectionTagsUpdate(tagsUpdates) {
      await this.handleTagsUpdate({
        items: this.mailingsSelection.map((mailing) => mailing.id),
        tags: tagsUpdates,
      });
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
  <bs-layout-left-menu>
    <template #menu>
      <v-list>
        <v-list-item v-if="isGroupAdmin" nuxt :href="groupAdminUrl">
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
        <workspace-tree ref="workspaceTree" />
      </div>
    </template>
    <v-card>
      <v-skeleton-loader :loading="mailingsIsLoading" type="table">
        <mailings-header @on-refresh="refreshLeftMenuData" />
        <mailings-selection-actions
          ref="mailingSelectionActions"
          :mailings-selection="mailingsSelection"
          :tags="tags"
          :has-ftp-access="hasFtpAccess"
          @createTag="onTagCreate"
          @updateTags="onMailSelectionTagsUpdate"
          @on-refetch="fetchMailListingData()"
        />
        <mailings-filters :tags="tags" @change="handleFilterChange" />
        <mailings-table
          v-model="mailingsSelection"
          :mailings="filteredMailings"
          :has-ftp-access="hasFtpAccess"
          :tags="tags"
          @on-single-mail-download="handleDownloadSingleMail"
          @on-refetch="fetchMailListingData()"
          @update-tags="onMailTableTagsUpdate"
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
