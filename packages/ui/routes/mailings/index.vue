<script>
import { mapGetters, mapMutations } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import mixinPageTitle from '~/helpers/mixin-page-title.js';
import * as acls from '~/helpers/pages-acls.js';
import {
  mailings,
  templates,
  mailingsItem,
  mailingsItemDuplicate,
  mailingsItemTransferToUser,
} from '~/helpers/api-routes.js';
import * as mailingsHelpers from '~/helpers/mailings.js';
import BsMailingsFilter from '~/components/mailings/filters.vue';
import BsMailingsSelectionActions from '~/components/mailings/selection-actions.vue';
import BsMailingsTable from '~/components/mailings/table.vue';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import BsMailingsModalDuplicate from '~/components/mailings/modal-duplicate.vue';
import BsMailingsModalTransfer from '~/components/mailings/modal-transfer.vue';
import { IS_ADMIN, USER, IS_GROUP_ADMIN } from '../../store/user';
import WorkspaceList from '~/components/group/workspaces-list';

export default {
  name: 'PageMailings',
  components: {
    BsMailingsFilter,
    BsMailingsSelectionActions,
    BsMailingsTable,
    BsMailingsModalRename,
    BsMailingsModalDuplicate,
    BsMailingsModalTransfer,
    WorkspaceList,
  },
  mixins: [mixinPageTitle],
  meta: { acl: acls.ACL_USER },
  // https://vuetifyjs.com/en/components/data-tables#custom-filtering
  async asyncData(nuxtContext) {
    const { $axios } = nuxtContext;
    try {
      const [mailingsResponse, templatesResponse] = await Promise.all([
        $axios.$get(mailings()),
        $axios.$get(templates()),
      ]);
      return {
        mailings: mailingsResponse.items,
        tags: mailingsResponse.meta.tags,
        templates: templatesResponse.items,
      };
    } catch (error) {
      console.log(error);
    }
  },
  data() {
    return {
      tags: [],
      defaultWorkspace: null,
      workspaces: [],
      selectedSpaceItem: null,
      mailings: [],
      mailingsSelection: [],
      templates: [],
      loading: false,
      renameModalInfo: {
        show: false,
        newName: '',
        mailingId: false,
      },
      duplicateModalInfo: {
        show: false,
        name: '',
        mailingId: false,
      },
      transferModalInfo: {
        show: false,
        mailingId: false,
        templateId: false,
      },
      filters: {
        show: false,
        name: '',
        templates: [],
        createdAtStart: '',
        createdAtEnd: '',
        updatedAtStart: '',
        updatedAtEnd: '',
        tags: [],
      },
    };
  },
  head() {
    return { title: this.title };
  },
  computed: {
    ...mapGetters(USER, {
      isAdmin: IS_ADMIN,
      isGroupAdmin: IS_GROUP_ADMIN,
    }),
    title() {
      return this.$tc('global.mailing', 2);
    },
    breadcrumbsData() {
      return this.formatPathToBreadcrumbsData(this.selectedSpaceItem);
    },
    selecteMailingsIdsList() {
      return this.mailingsSelection.map((mailing) => mailing.id);
    },
    filteredMailings() {
      const filterFunction = mailingsHelpers.createFilters(this.filters);
      return this.mailings.filter(filterFunction);
    },
    hasMailingsSelection() {
      return this.mailingsSelection.length > 0;
    },
    colWidth() {
      return this.isAdmin ? '12' : '10';
    },
    groupAdminUrl() {
      return `/groups/${this.$store.state.user?.info?.group?.id}`;
    },
  },
  watch: {
    // call again the method if the route changes
    $route: 'fetchData',
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    formatPathToBreadcrumbsData(formatData) {
      let items = [];
      if (formatData?.path) {
        items[0] = {
          text: formatData?.path?.name,
          id: formatData?.path?.id,
          type: formatData?.path?.type,
          disabled: !formatData?.path?.pathChild,
        };
        items = this.getRecursivePathChild(items, formatData?.path);
      }
      return items;
    },
    getRecursivePathChild(array, path) {
      if (path?.pathChild && Array.isArray(array)) {
        array.push({
          text: path?.pathChild?.name,
          id: path?.pathChild?.id,
          type: path?.pathChild?.type,
          disabled: !path?.pathChild?.pathChild,
        });
        return this.getRecursivePathChild(array, path?.pathChild);
      }
      return array;
    },
    async onDelete(_) {
      const { $axios } = this;
      this.loading = true;
      try {
        // we need to pass the `body` as `data` for DEL methods
        // • https://github.com/axios/axios/issues/736#issuecomment-377829542
        const mailingsResponse = await $axios.$delete(mailings(), {
          data: { items: this.selecteMailingsIdsList },
        });
        this.tags = mailingsResponse.meta.tags;
        this.mailings = this.mailings.filter((mailing) => {
          return !mailingsResponse.items.includes(mailing.id);
        });
        this.mailingsSelection = [];
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
    onTagCreate(newTag) {
      this.tags = [...new Set([newTag, ...this.tags])];
    },
    async onTagsUpdate(tagsUpdates) {
      const { $axios } = this;
      this.loading = true;
      try {
        const mailingsResponse = await $axios.$put(mailings(), {
          items: this.selecteMailingsIdsList,
          tags: tagsUpdates,
        });
        this.tags = mailingsResponse.meta.tags;
        mailingsResponse.items.forEach((updatedMailing) => {
          const mailingIndex = this.mailings.findIndex(
            (mailing) => mailing.id === updatedMailing.id
          );

          this.mailingsSelection.findIndex(
            (mailing) => mailing.id === updatedMailing.id
          );

          this.$set(this.mailings, mailingIndex, updatedMailing);
          this.$set(this.mailingsSelection, mailingIndex, updatedMailing);
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
    displayRenameModal(mailing) {
      this.renameModalInfo = {
        show: true,
        newName: mailing.name,
        mailingId: mailing.id,
      };
    },
    closeRenameModal() {
      this.renameModalInfo = {
        show: false,
        newName: '',
        mailingId: false,
      };
    },
    async updateName(renameModalInfo) {
      const { $axios } = this;
      const { newName, mailingId } = renameModalInfo;
      this.closeRenameModal();
      if (!mailingId) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId });
      try {
        const mailingResponse = await $axios.$put(updateUri, { name: newName });
        const mailingIndex = this.mailings.findIndex(
          (mailing) => mailing.id === mailingResponse.id
        );
        this.$set(this.mailings, mailingIndex, mailingResponse);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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

    displayDuplicateModal(mailing) {
      this.duplicateModalInfo = {
        show: true,
        name: mailing.name,
        mailingId: mailing.id,
      };
    },
    closeDuplicateModal() {
      this.duplicateModalInfo = {
        show: false,
        name: '',
        mailingId: false,
      };
    },
    async duplicateMailing(duplicateModalInfo) {
      const { $axios } = this;
      const { mailingId } = duplicateModalInfo;
      this.closeDuplicateModal();
      if (!mailingId) return;
      this.loading = true;
      const duplicateUri = mailingsItemDuplicate({ mailingId });
      try {
        const mailingResponse = await $axios.$post(duplicateUri);
        this.mailings.push(mailingResponse);
        this.showSnackbar({
          text: this.$t('snackbars.updated'),
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
    displayTransferModal(mailing) {
      this.transferModalInfo = {
        show: true,
        mailingId: mailing.id,
        templateId: mailing.templateId,
      };
    },
    closeTransferModal() {
      this.transferModalInfo = {
        show: false,
        mailingId: false,
        groupId: false,
      };
    },
    initWorkSpaceData(workspaceData) {
      this.workspaces = workspaceData;
    },
    initDefaultWorkspace(defaultWorkspace) {
      this.defaultWorkspace = defaultWorkspace;
    },
    handleActiveListItem(event) {
      this.selectedSpaceItem = event;
    },
    async transferMailing(transferInfo = {}) {
      const { $axios } = this;
      const { mailingId, userId } = transferInfo;
      this.closeTransferModal();
      if (!mailingId || !userId) return;
      this.loading = true;
      const trasnferUri = mailingsItemTransferToUser({ mailingId });
      try {
        const mailingResponse = await $axios.$post(trasnferUri, { userId });
        this.mailings = this.mailings.filter(
          (mailing) => mailing.id !== mailingResponse.id
        );
        this.showSnackbar({
          text: this.$t('mailings.transfer.success'),
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
    async fetchData() {
      try {
        this.defaultWorkspace = {
          ...this.$route.query,
        };
        const mailingsResponse = await this.$axios.$get(mailings(), {
          params: this.defaultWorkspace,
        });
        this.mailings = mailingsResponse?.items || [];
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      }
    },
  },
};
</script>

<template>
  <v-container fluid class="fill-height">
    <v-row class="fill-height">
      <v-col v-if="!isAdmin" class="pl-0" cols="2">
        <v-navigation-drawer class="d-flex" permanent width="300">
          <v-row>
            <v-col cols="12">
              <v-list dense>
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
            </v-col>
            <v-col cols="12">
              <workspace-list
                :default-item="defaultWorkspace"
                :set-parent-component-workspace-data="initWorkSpaceData"
                :set-default-workspace="initDefaultWorkspace"
                @active-list-item="handleActiveListItem"
              />
            </v-col>
          </v-row>
        </v-navigation-drawer>
      </v-col>
      <v-col :cols="colWidth">
        <v-card>
          <v-breadcrumbs :items="breadcrumbsData">
            <template #divider>
              <v-icon>mdi-chevron-right</v-icon>
            </template>
            <template #item="{ item }">
              <v-breadcrumbs-item
                :replace="true"
                :to="{ path: '/', query: { id: item.id, type: item.type } }"
                :disabled="item.disabled"
              >
                {{ item.text.toUpperCase() }}
              </v-breadcrumbs-item>
            </template>
          </v-breadcrumbs>
        </v-card>
        <v-card>
          <bs-mailings-selection-actions
            :mailings-selection="mailingsSelection"
            :tags="tags"
            :loading="loading"
            @deleteMailings="onDelete"
            @createTag="onTagCreate"
            @updateTags="onTagsUpdate"
          />
          <bs-mailings-filter
            v-if="!hasMailingsSelection"
            v-model="filters"
            :tags="tags"
            :templates="templates"
          />
          <bs-mailings-table
            v-model="mailingsSelection"
            :mailings="filteredMailings"
            :loading="loading"
            @transfer="displayTransferModal"
            @duplicate="displayDuplicateModal"
            @rename="displayRenameModal"
          />
          <bs-mailings-modal-rename
            v-model="renameModalInfo"
            @update="updateName"
            @close="closeRenameModal"
          />
          <bs-mailings-modal-duplicate
            v-model="duplicateModalInfo"
            @duplicate="duplicateMailing"
            @close="closeDuplicateModal"
          />
          <bs-mailings-modal-transfer
            v-model="transferModalInfo"
            @transfer="transferMailing"
            @close="closeTransferModal"
          />
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
