<script>
import { mapMutations, mapGetters, mapState } from 'vuex';

import { PAGE, SHOW_SNACKBAR } from '~/store/page.js';
import { USER, IS_ADMIN } from '~/store/user.js';
import { FOLDER, SET_PAGINATION } from '~/store/folder.js';
import MailingsCopyModal from '~/routes/mailings/__partials/mailings-copy-modal';
import MailingsMoveModal from '~/routes/mailings/__partials/mailings-move-modal';
import MailingsPreviewModal from '~/routes/mailings/__partials/mailings-preview-modal';
import BsMailingModalDuplicateTranslate from '~/components/mailings/modal-duplicate-translate.vue';
import BsMailingModalTranslationWarning from '~/components/mailings/modal-translation-warning.vue';

import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';

import {
  mailingsItem,
  copyMail,
  moveMail,
  aiFeatures,
} from '~/helpers/api-routes.js';
import {
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
} from '~/helpers/constants/table-config.js';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import MailingsTagsMenu from './mailings-tags-menu';

import { ACTIONS, ACTIONS_DETAILS } from '~/helpers/constants/mails';
import { escapeHtml } from '~/helpers/escape-html';
import {
  MessageCircle,
  TextCursor,
  Copy,
  Trash2,
  Mail,
  Tag,
  Maximize2,
  Eye,
  ArrowRight,
  Languages,
  Download,
  Server,
} from 'lucide-vue';
import BsRowActions from '~/components/row-actions/bs-row-actions.vue';

const COLUMN_USERNAME = 'userName';
const TABLE_HIDDEN_COLUMNS_ADMIN = [COLUMN_USERNAME, ACTIONS.COPY_MAIL];
const TABLE_HIDDEN_COLUMNS_USER = [ACTIONS.TRANSFER];
const TABLE_HIDDEN_COLUMNS_NO_ACCESS = [
  ACTIONS.RENAME,
  ACTIONS.DELETE,
  ACTIONS.ADD_TAGS,
  ACTIONS.MOVE_MAIL,
];

const TABLE_ACTIONS = [
  ACTIONS.RENAME,
  ACTIONS.TRANSFER,
  ACTIONS.ADD_TAGS,
  ACTIONS.DELETE,
  ACTIONS.COPY_MAIL,
  ACTIONS.MOVE_MAIL,
  ACTIONS.DUPLICATE_TRANSLATE,
  ACTIONS.PREVIEW,
  ACTIONS.DOWNLOAD,
  ACTIONS.DOWNLOAD_FTP,
  'actionMoveMail',
];

export default {
  name: 'MailingsTable',
  TABLE_FOOTER_PROPS,
  TABLE_PAGINATION_THRESHOLD,
  components: {
    BsMailingsModalRename,
    BsModalConfirmForm,
    MailingsCopyModal,
    BsRowActions,
    MailingsTagsMenu,
    MailingsMoveModal,
    MailingsPreviewModal,
    BsMailingModalDuplicateTranslate,
    BsMailingModalTranslationWarning,
    LucideMail: Mail,
    // Lucide icons for BsRowActions are imported at top but passed as strings
    // They're resolved dynamically by BsRowActions component
  },
  mixins: [mixinCurrentLocation],
  model: { prop: 'mailingsSelection', event: 'input' },
  props: {
    mailings: { type: Array, default: () => [] },
    mailingsSelection: { type: Array, default: () => [] },
    hasFtpAccess: { type: Boolean, default: false },
    currentPage: { type: Number, default: 1 },
    itemsLength: { type: Number, default: 0 },
  },
  data() {
    return {
      loading: false,
      dialogRename: false,
      selectedMailing: {},
      tableActions: TABLE_ACTIONS,
      actions: ACTIONS,
      actionsDetails: ACTIONS_DETAILS,
      search: '',
      hasActiveTranslation: false,
    };
  },
  computed: {
    ...mapGetters(USER, { isAdmin: IS_ADMIN }),
    ...mapState(FOLDER, [
      'pagination',
      'tags',
      'isLoadingMailingsForFilterUpdate',
    ]),
    hiddenCols() {
      const excludedRules = this.isAdmin
        ? TABLE_HIDDEN_COLUMNS_ADMIN
        : TABLE_HIDDEN_COLUMNS_USER;
      if (!this.hasAccess) {
        return [...excludedRules, ...TABLE_HIDDEN_COLUMNS_NO_ACCESS];
      }
      return excludedRules.filter(
        (rule) => !TABLE_HIDDEN_COLUMNS_NO_ACCESS.includes(rule)
      );
    },
    selectedRows: {
      get() {
        return this.mailingsSelection;
      },
      set(newSelection) {
        this.$emit('input', newSelection);
      },
    },
    tablesHeaders() {
      return [
        { text: this.$t('global.name'), align: 'left', value: 'name' },
        { text: this.$t('global.author'), align: 'left', value: 'userName' },
        {
          text: this.$tc('global.template', 1),
          align: 'left',
          value: 'templateName',
        },
        {
          text: this.$t('global.tags'),
          align: 'left',
          value: 'tags',
          sortable: false,
        },
        { text: this.$t('global.createdAt'), value: 'createdAt' },
        { text: this.$t('global.updatedAt'), value: 'updatedAt' },
        {
          text: this.$t('global.actions'),
          value: 'actions',
          align: 'right',
          class: 'table-column-action',
          sortable: false,
        },
      ].filter((column) => !this.hiddenCols.includes(column.value));
    },
    tableOptions: {
      get() {
        return {
          page: this.currentPage,
          itemsPerPage: this.pagination?.itemsPerPage || 25,
          sortBy: Array.isArray(this.pagination?.sortBy)
            ? this.pagination.sortBy
            : [],
          sortDesc: Array.isArray(this.pagination?.sortDesc)
            ? this.pagination.sortDesc
            : [],
        };
      },
      set() {
        // Handled by handleOptionsChange
      },
    },
    hideFooter() {
      return this.itemsLength <= this.$options.TABLE_PAGINATION_THRESHOLD;
    },
    filteredActions() {
      const hidden = this.hiddenCols;
      return this.tableActions.filter((action) => {
        if (
          action === ACTIONS.DUPLICATE_TRANSLATE &&
          !this.hasActiveTranslation
        ) {
          return false;
        }
        return !hidden.includes(action);
      });
    },
    selectedMailTags() {
      return this.selectedMailing?.tags || [];
    },
  },
  watch: {
    dialogRename(val) {
      val || this.closeRename();
    },
  },
  async mounted() {
    const groupId = this.$store.state.user?.info?.group?.id;
    if (!groupId) return;
    try {
      const config = await this.$axios.$get(aiFeatures(groupId));

      const features = config?.features || [];

      const translation = features.find((f) => f.featureType === 'translation');

      this.hasActiveTranslation = !!(
        translation?.isActive && translation?.integration?.isActive
      );
    } catch {
      this.hasActiveTranslation = false;
    }
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    escapeHtml,
    handleRowClick(item) {
      if (this.hasAccess) {
        window.location.href = `/editor/${item.id}`;
      }
    },
    /**
     * Build quick actions (always visible) for a mailing row
     * Design System: Comment, Rename, Copy, Delete
     */
    buildQuickActions(item) {
      const actions = [];

      // 1. Comment (with unresolved badge)
      if (this.hasAccess) {
        actions.push({
          key: 'comment',
          icon: MessageCircle,
          text: 'mailings.openComments',
          badge:
            item.unresolvedCommentsCount > 0
              ? item.unresolvedCommentsCount
              : null,
          onClick: () => {
            window.location.href = `/editor/${item.id}?comments=1`;
          },
        });
      }

      // 2. Rename
      if (this.filteredActions.includes(this.actions.RENAME)) {
        actions.push({
          key: 'rename',
          icon: TextCursor,
          text: this.actionsDetails[this.actions.RENAME].text,
          onClick: () => this.openRenameModal(item),
        });
      }

      // 3. Copy
      if (this.filteredActions.includes(this.actions.COPY_MAIL)) {
        actions.push({
          key: 'copy',
          icon: Copy,
          text: this.actionsDetails[this.actions.COPY_MAIL].text,
          onClick: () => this.openCopyMail(item),
        });
      }

      // 4. Delete
      if (this.filteredActions.includes(this.actions.DELETE)) {
        actions.push({
          key: 'delete',
          icon: Trash2,
          text: this.actionsDetails[this.actions.DELETE].text,
          variant: 'danger',
          onClick: () => this.displayDeleteModal(item),
        });
      }

      return actions;
    },
    /**
     * Build menu actions (behind kebab) for a mailing row
     * Design System: Tags, Transfer, Preview, Move, Duplicate+Translate | Download, FTP | Delete
     */
    buildMenuActions(item) {
      const actions = [];

      // Main actions group
      if (this.filteredActions.includes(this.actions.ADD_TAGS)) {
        actions.push({
          key: 'tags',
          icon: Tag,
          text: this.actionsDetails[this.actions.ADD_TAGS].text,
          count: item.tags?.length || null,
          onClick: () => this.openTagsMenu(item),
        });
      }

      if (this.filteredActions.includes(this.actions.TRANSFER)) {
        actions.push({
          key: 'transfer',
          icon: Maximize2,
          text: this.actionsDetails[this.actions.TRANSFER].text,
          onClick: () => this.transferMailing(item),
        });
      }

      actions.push({
        key: 'preview',
        icon: Eye,
        text: this.actionsDetails[this.actions.PREVIEW].text,
        onClick: () => this.openPreviewMail(item),
      });

      if (this.filteredActions.includes(this.actions.MOVE_MAIL)) {
        actions.push({
          key: 'move',
          icon: ArrowRight,
          text: this.actionsDetails[this.actions.MOVE_MAIL].text,
          onClick: () => this.openMoveMail(item),
        });
      }

      if (this.filteredActions.includes(this.actions.DUPLICATE_TRANSLATE)) {
        actions.push({
          key: 'duplicate-translate',
          icon: Languages,
          text: this.actionsDetails[this.actions.DUPLICATE_TRANSLATE].text,
          onClick: () => this.openDuplicateTranslateModal(item),
        });
      }

      // Export group (separated by divider)
      actions.push({ type: 'divider' });

      if (this.filteredActions.includes(this.actions.DOWNLOAD)) {
        actions.push({
          key: 'download',
          icon: Download,
          text: this.actionsDetails[this.actions.DOWNLOAD].text,
          onClick: () =>
            this.handleDownloadMail({ mailing: item, isWithFtp: false }),
        });
      }

      if (this.filteredActions.includes(this.actions.DOWNLOAD_FTP)) {
        actions.push({
          key: 'ftp',
          icon: Server,
          text: this.actionsDetails[this.actions.DOWNLOAD_FTP].text,
          disabled: !this.hasFtpAccess,
          onClick: () =>
            this.handleDownloadMail({ mailing: item, isWithFtp: true }),
        });
      }

      // Destructive action (Delete) - isolated by divider
      if (this.filteredActions.includes(this.actions.DELETE)) {
        actions.push({ type: 'divider' });
        actions.push({
          key: 'delete-menu',
          icon: Trash2,
          text: this.actionsDetails[this.actions.DELETE].text,
          variant: 'danger',
          onClick: () => this.displayDeleteModal(item),
        });
      }

      return actions;
    },
    openRenameModal(mailing) {
      this.$refs.renameDialog.open({
        newName: mailing.name,
        mailingId: mailing.id,
      });
    },
    displayDeleteModal(mailing) {
      this.selectedMailing = mailing;
      this.$refs.deleteDialog.open({
        name: mailing.name,
        id: mailing.id,
      });
    },
    openTagsMenu(mailing) {
      this.selectedMailing = mailing;
      this.$refs.addTagsMenu.openMenu({
        name: mailing.name,
        id: mailing.id,
      });
    },
    closeRename() {
      this.$refs.renameDialog.close();
    },
    openCopyMail(mailing) {
      this.$refs.copyMailDialog.open({
        name: mailing.name,
        id: mailing.id,
      });
    },
    openMoveMail(mailing) {
      this.$refs.moveMailDialog.open({
        mail: {
          name: mailing.name,
          id: mailing.id,
        },
        location: this.currentLocation,
      });
    },
    openPreviewMail(mailing) {
      this.$refs.previewMailDialog.open({
        mail: {
          name: mailing.name,
          id: mailing.id,
        },
      });
    },
    closeCopyMailDialog() {
      this.$refs.copyMailDialog.close();
    },
    closeMoveMailDialog() {
      this.$refs.moveMailDialog.close();
    },
    closeDelete() {
      this.$refs.deleteDialog.close();
    },
    async updateName(renameModalInfo) {
      const { $axios } = this;
      const { newName, mailingId } = renameModalInfo;
      this.closeRename();
      if (!mailingId) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId });
      try {
        await $axios.$patch(updateUri, {
          mailingName: newName,
          workspaceId: this.$route.query.wid,
          parentFolderId: this.$route.query.fid,
        });
        this.$emit('on-refetch');
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
    async handleDelete(mailing) {
      const { $axios } = this;
      const { id } = mailing;
      this.closeDelete();
      if (!id) return;
      this.loading = true;
      const updateUri = mailingsItem({ mailingId: id });
      try {
        await $axios.$delete(updateUri, {
          data: this.currentLocationParam,
        });
        this.$emit('on-refetch');
        this.showSnackbar({
          text: this.$t('snackbars.deleted'),
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
    async copyMail({ selectedLocation, mailingId }) {
      try {
        await this.$axios.$post(copyMail(), {
          mailingId,
          ...(selectedLocation.type === 'workspace' && {
            workspaceId: selectedLocation.id,
          }),
          ...(selectedLocation.type === 'folder' && {
            folderId: selectedLocation.id,
          }),
        });

        // if copy to current location
        if (
          selectedLocation.id === this.workspace?.id ||
          selectedLocation.id === this.folder?.id
        ) {
          this.$emit('on-refetch');
        }

        // else, redirect to destination
        this.$router.push({
          query: {
            ...(selectedLocation.type === 'workspace' && {
              wid: selectedLocation.id,
            }),
            ...(selectedLocation.type === 'folder' && {
              fid: selectedLocation.id,
            }),
          },
        });

        this.showSnackbar({
          text: this.$t('mailings.copyMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeCopyMailDialog();
    },
    async moveMail({ destinationParam, mailingId }) {
      try {
        await this.$axios.$post(
          moveMail({
            mailingId,
          }),
          {
            mailingId,
            ...destinationParam,
          }
        );

        let routerRedirectionParam;
        if (destinationParam?.parentFolderId) {
          routerRedirectionParam = { fid: destinationParam?.parentFolderId };
        } else {
          routerRedirectionParam = { wid: destinationParam?.workspaceId };
        }

        await this.$router.push({
          query: routerRedirectionParam,
        });
        this.showSnackbar({
          text: this.$t('mailings.moveMailSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeMoveMailDialog();
    },
    handleOptionsChange(options) {
      const { page, itemsPerPage, sortBy, sortDesc } = options;
      const currentPagination = this.pagination || {};

      const newPage = page;
      const newItemsPerPage = itemsPerPage;
      // Keep sortBy/sortDesc as arrays end-to-end: the backend only applies the
      // sort when both are arrays (mailing.schema.js findForApiWithPagination),
      // so storing scalars here silently disabled column sorting.
      const newSortBy = Array.isArray(sortBy) ? sortBy : [];
      const newSortDesc = Array.isArray(sortDesc) ? sortDesc : [];

      const hasChanges =
        newPage !== this.currentPage ||
        newItemsPerPage !== currentPagination.itemsPerPage ||
        newSortBy[0] !== currentPagination.sortBy?.[0] ||
        newSortDesc[0] !== currentPagination.sortDesc?.[0];

      if (hasChanges) {
        // Reset to page 1 when changing items per page
        const targetPage =
          newItemsPerPage !== currentPagination.itemsPerPage ? 1 : newPage;

        this.$store.commit(`${FOLDER}/${SET_PAGINATION}`, {
          page: targetPage,
          itemsPerPage: newItemsPerPage,
          sortBy: newSortBy,
          sortDesc: newSortDesc,
        });
        this.$emit('update:page', targetPage);
        this.$emit('on-refetch');
      }
    },
    transferMailing(mailing) {
      this.$emit('transfer', mailing);
    },
    display(mailing) {
      this.$emit('copyMail', mailing);
    },
    updateTags(tags) {
      this.$emit('update-tags', {
        selectedMailing: this.selectedMailing,
        tags,
      });
    },
    async handleDownloadMail({ mailing, isWithFtp }) {
      this.$emit('on-single-mail-download', {
        mailing,
        isWithFtp,
      });
    },
    openDuplicateTranslateModal(mailing) {
      this.$refs.duplicateTranslateDialog.open(mailing);
    },
    handleTranslated() {
      this.$emit('on-refetch');
    },
    showTranslationWarning() {
      if (this.$refs.translationWarningDialog) {
        this.$refs.translationWarningDialog.open();
      }
    },
  },
};
</script>

<template>
  <div class="mailings-table-wrapper">
    <v-skeleton-loader :loading="isLoadingMailingsForFilterUpdate" type="table">
      <v-data-table
        v-model="selectedRows"
        :headers="tablesHeaders"
        :items="mailings"
        :server-items-length="itemsLength"
        :page="currentPage"
        :items-per-page="tableOptions.itemsPerPage"
        :sort-by="tableOptions.sortBy"
        :sort-desc="tableOptions.sortDesc"
        must-sort
        :show-select="hasAccess"
        :hide-default-footer="hideFooter"
        :footer-props="$options.TABLE_FOOTER_PROPS"
        :class="{
          'clickable-rows': hasAccess,
          'has-select': hasAccess,
        }"
        @update:options="handleOptionsChange"
        @click:row="handleRowClick"
      >
        <template #item.name="{ item }">
          <!-- /editor lives outside the Nuxt SPA, so a real <a href> + full
               reload, not <nuxt-link>. Middle-click opens in a new tab. -->
          <a
            v-if="hasAccess"
            :href="`/editor/${item.id}`"
            class="mailing-name font-weight-medium"
            @click.stop
          >
            {{ item.name }}
          </a>
          <span v-else class="mailing-name font-weight-medium">
            {{ item.name }}
          </span>
        </template>
        <template #item.userName="{ item }">
          <nuxt-link v-if="isAdmin" :to="`/users/${item.userId}`">
            {{ item.userName }}
          </nuxt-link>
          <span v-else>{{ item.userName }}</span>
        </template>
        <template #item.templateName="{ item }">
          <nuxt-link v-if="isAdmin" :to="`/templates/${item.templateId}`">
            {{ item.templateName }}
          </nuxt-link>
          <span v-else>{{ item.templateName }}</span>
        </template>
        <template #item.tags="{ item }">
          <span v-for="tag in item.tags" :key="tag" class="tags">{{
            tag
          }}</span>
        </template>
        <template #item.createdAt="{ item }">
          <span>{{ item.createdAt | preciseDateTime }}</span>
        </template>
        <template #item.updatedAt="{ item }">
          <span>{{ item.updatedAt | preciseDateTime }}</span>
        </template>
        <template #item.actions="{ item }">
          <bs-row-actions
            :quick-actions="buildQuickActions(item)"
            :menu-actions="buildMenuActions(item)"
          />
        </template>

        <template #no-data>
          <div class="empty-state">
            <lucide-mail :size="48" class="empty-state__icon" />
            <p class="empty-state__text">
              {{ $t('mailings.noMailingsAvailable') }}
            </p>
          </div>
        </template>
      </v-data-table>

      <bs-mailings-modal-rename ref="renameDialog" @update="updateName" />
      <mailings-tags-menu
        ref="addTagsMenu"
        :tags="tags"
        :selected-mail-tags="selectedMailTags"
        @update-tags="updateTags"
      />
      <bs-modal-confirm-form
        ref="deleteDialog"
        :with-input-confirmation="false"
        @confirm="handleDelete"
      >
        <p
          class="black--text"
          v-html="
            $t('groups.mailingTab.deleteWarningMessage', {
              name: escapeHtml(selectedMailing.name),
            })
          "
        />
      </bs-modal-confirm-form>
      <mailings-copy-modal ref="copyMailDialog" @confirm="copyMail">
        <p
          class="black--text"
          v-html="$t('mailings.copyMailConfirmationMessage')"
        />
      </mailings-copy-modal>
      <mailings-move-modal
        ref="moveMailDialog"
        :title="`${this.$t('global.moveMail')}`"
        @confirm="moveMail"
      >
        <p
          class="black--text"
          v-html="$t('mailings.moveMailConfirmationMessage')"
        />
      </mailings-move-modal>
      <mailings-preview-modal ref="previewMailDialog" />
      <bs-mailing-modal-duplicate-translate
        ref="duplicateTranslateDialog"
        @translated="handleTranslated"
        @show-warning="showTranslationWarning"
      />
    </v-skeleton-loader>
    <bs-mailing-modal-translation-warning ref="translationWarningDialog" />
  </div>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable — LePatron Design System v1.0
   Standardized table pattern for Mailings (reference implementation)
   Based on: /tmp/lepatron-design-v2/project/preview/components-data-table.html
   ========================================================================= */

/* `::v-deep` is required because Vuetify's `<v-data-table>` renders <thead>,
   <tbody>, <th>, <td> internally — they don't carry this component's
   data-v-X attribute, so a plain scoped `.v-data-table thead th` selector
   would never match. */
.mailings-table-wrapper ::v-deep {
  /* Shell - already handled by v-data-table but ensure borders */
  .v-data-table {
    border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
    border-radius: 10px; // --r-md
    overflow: hidden;
  }

  /* -------- Table headers (BsDataTable spec) ----------------------------- */
  .v-data-table thead th {
    font-size: 11px !important;
    font-weight: 600 !important;
    letter-spacing: 0.04em !important;
    text-transform: uppercase !important;
    color: rgba(0, 0, 0, 0.6) !important; // --gray-600
    padding: 10px 16px !important;
    background: rgba(0, 0, 0, 0.02) !important; // --gray-50
    border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important; // --gray-300
    height: 40px !important;
  }

  /* -------- Table rows (BsDataTable spec) -------------------------------- */
  .v-data-table tbody td {
    padding: 10px 16px !important;
    font-size: 13px !important;
    color: rgba(0, 0, 0, 0.87) !important; // --gray-900
    border-bottom: 1px solid rgba(0, 0, 0, 0.08) !important; // --gray-200
    height: 40px !important;
  }

  .v-data-table tbody tr:last-child td {
    border-bottom: none !important;
  }

  /* -------- Name cell link -------------------------------------------------
     Match the admin BsDataTable pattern: dark default text, underline +
     primary tint on hover. The cell is now a real <a href> so reset the
     default browser link color/underline. */
  .v-data-table tbody td .mailing-name {
    font-weight: 500;
    color: rgba(0, 0, 0, 0.87);
    text-decoration: none;
  }

  .clickable-rows tbody tr a.mailing-name {
    cursor: pointer;
  }

  .clickable-rows tbody tr:hover .mailing-name {
    text-decoration: underline;
    color: var(--v-primary-base);
  }

  /* -------- Row states ---------------------------------------------------- */
  .v-data-table tbody tr {
    transition: background 0.15s ease-out;

    &:hover {
      background: rgba(
        0,
        172,
        220,
        0.05
      ) !important; // accent blue (BsDataTable spec)
    }
  }

  .clickable-rows tbody tr {
    cursor: pointer;
  }

  .v-data-table tbody tr.v-data-table__selected {
    background: rgba(
      0,
      172,
      220,
      0.06
    ) !important; // Design system selected state
  }

  .v-data-table tbody tr.v-data-table__selected:hover {
    background: rgba(
      0,
      172,
      220,
      0.1
    ) !important; // Design system selected + hover
  }

  /* -------- Muted cells (author, template, dates) ------------------------
     Mirror the admin BsDataTable: secondary info in lighter gray, the
     name keeps the default 87% color via .mailing-name above. */
  .v-data-table tbody td:has(a),
  .v-data-table tbody td:has(span:not(.tags):not(.mailing-name)) {
    color: rgba(0, 0, 0, 0.6) !important; // --gray-600
  }

  /* Tabular alignment for dates only — pick them up via the
     `font-variant-numeric: tabular-nums` rule on cells with date spans. */
  .v-data-table tbody td:has(span[data-v-]) {
    font-variant-numeric: tabular-nums;
  }

  /* -------- Actions column ------------------------------------------------ */
  .v-data-table thead th:last-child,
  .v-data-table tbody td:last-child {
    text-align: right !important;
    width: 1% !important;
    white-space: nowrap !important;
  }

  /* -------- Checkbox column -----------------------------------------------
     Scoped to `.has-select`: without this guard, the rule bites the NAME
     column whenever `show-select` is off (e.g. read-only workspaces),
     forcing it to 36px and wrapping the title onto 3 lines. */
  .v-data-table.has-select thead th:first-child,
  .v-data-table.has-select tbody td:first-child {
    width: 36px !important;
    padding-right: 0 !important;
  }

  /* Comment icon with badge (unchanged, already correct) */
  .comment-icon-wrapper {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  .comment-badge {
    position: absolute;
    top: -6px;
    right: -10px;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    background-color: var(--v-accent-base);
    color: #fff;
    font-size: 11px;
    font-weight: 600;
    line-height: 18px;
    text-align: center;
    border-radius: 9px;
    box-sizing: border-box;
  }
}
</style>

<style lang="scss" scoped>
.v-list {
  cursor: pointer;
}

/* -------- Tags (BsDataTable spec) -------------------------------------- */
.tags {
  display: inline-flex;
  align-items: center;
  padding: 1px 8px;
  margin-right: 4px;
  border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
  border-radius: 9999px; // --r-pill
  font-size: 11px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.54); // --gray-700
  background: #fff;
}

/* -------- Empty state (BsDataTable spec) ------------------------------- */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  text-align: center;

  &__icon {
    color: rgba(0, 0, 0, 0.26); // --gray-500
    margin-bottom: 12px;
  }

  &__text {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 600;
    color: rgba(0, 0, 0, 0.87); // --gray-900
  }
}
</style>
