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

import { mailingsItem, copyMail, moveMail } from '~/helpers/api-routes.js';
import { TABLE_ITEMS_PER_PAGE_OPTIONS } from '~/helpers/constants/table-config.js';
import BsMailingsModalRename from '~/components/mailings/modal-rename.vue';
import BsModalConfirmForm from '~/components/modal-confirm-form';
import BsMailingsActionsDropdown from './mailings-actions-dropdown';
import BsMailingsActionsDropdownItem from './mailings-actions-dropdown-item';
import MailingsTagsMenu from './mailings-tags-menu';

import { ACTIONS, ACTIONS_DETAILS } from '~/helpers/constants/mails';
import { MessageCircle, Pencil, Copy, Trash2, Mail } from 'lucide-vue';

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
  TABLE_ITEMS_PER_PAGE_OPTIONS,
  components: {
    BsMailingsModalRename,
    BsModalConfirmForm,
    MailingsCopyModal,
    BsMailingsActionsDropdown,
    BsMailingsActionsDropdownItem,
    MailingsTagsMenu,
    MailingsMoveModal,
    MailingsPreviewModal,
    BsMailingModalDuplicateTranslate,
    BsMailingModalTranslationWarning,
    LucideMessageCircle: MessageCircle,
    LucidePencil: Pencil,
    LucideCopy: Copy,
    LucideTrash2: Trash2,
    LucideMail: Mail,
  },
  mixins: [mixinCurrentLocation],
  model: { prop: 'mailingsSelection', event: 'input' },
  props: {
    mailings: { type: Array, default: () => [] },
    mailingsSelection: { type: Array, default: () => [] },
    hasFtpAccess: { type: Boolean, default: false },
    currentPage: { type: Number, default: 1 },
    totalPages: { type: Number, default: 1 },
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
    localPage: {
      get() {
        return this.currentPage;
      },
      set(val) {
        this.$emit('update:page', val);
      },
    },
    showPagination() {
      return this.itemsLength > 0 && this.totalPages > 1;
    },
    filteredActions() {
      return this.tableActions.filter(
        (action) => !this.hiddenCols.includes(action)
      );
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
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
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
    handleItemsPerPageChange(itemsPerPage) {
      this.$store.commit(`${FOLDER}/${SET_PAGINATION}`, {
        page: 1,
        itemsPerPage: itemsPerPage,
      });
      this.$emit('on-refetch');
    },
    handleSortByChange(sortBy) {
      if (sortBy !== this.pagination?.sortBy) {
        this.$store.commit(`${FOLDER}/${SET_PAGINATION}`, {
          sortBy: sortBy,
        });
        this.$emit('on-refetch');
      }
    },
    handleSortDescChange(sortDesc) {
      if (sortDesc !== this.pagination?.sortDesc) {
        this.$store.commit(`${FOLDER}/${SET_PAGINATION}`, {
          sortDesc: sortDesc,
        });
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
        :options="pagination || {}"
        :items="mailings"
        must-sort
        :show-select="hasAccess"
        :footer-props="{
          pagination: pagination,
          disablePagination: true,
          prevIcon: 'none',
          nextIcon: 'none',
          itemsPerPageOptions: $options.TABLE_ITEMS_PER_PAGE_OPTIONS,
          itemsPerPageAllText: 'Tout',
        }"
        @sort-by="handleSortByChange"
        @sort-desc="handleSortDescChange"
        @update:items-per-page="handleItemsPerPageChange"
      >
        <template #item.name="{ item }">
          <a v-if="hasAccess" :href="`/editor/${item.id}`" class="email-link">
            {{ item.name }}
          </a>
          <span v-else class="font-weight-medium">{{ item.name }}</span>
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
          <div class="actions-cell">
            <!-- Quick action icons -->
            <v-tooltip v-if="hasAccess" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  :href="`/editor/${item.id}?comments=1`"
                  :aria-label="$t('mailings.openComments')"
                  class="action-icon"
                  v-bind="attrs"
                  v-on="on"
                >
                  <v-badge
                    :content="item.unresolvedCommentsCount || 0"
                    :value="item.unresolvedCommentsCount > 0"
                    color="accent"
                    overlap
                  >
                    <lucide-message-circle :size="18" />
                  </v-badge>
                </v-btn>
              </template>
              <span>{{ $t('mailings.openComments') }}</span>
            </v-tooltip>
            <v-tooltip v-if="filteredActions.includes(actions.RENAME)" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  class="action-icon"
                  :aria-label="$t(actionsDetails[actions.RENAME].text)"
                  v-bind="attrs"
                  v-on="on"
                  @click="openRenameModal(item)"
                >
                  <lucide-pencil :size="18" />
                </v-btn>
              </template>
              <span>{{ $t(actionsDetails[actions.RENAME].text) }}</span>
            </v-tooltip>
            <v-tooltip v-if="filteredActions.includes(actions.COPY_MAIL)" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  class="action-icon"
                  :aria-label="$t(actionsDetails[actions.COPY_MAIL].text)"
                  v-bind="attrs"
                  v-on="on"
                  @click="openCopyMail(item)"
                >
                  <lucide-copy :size="18" />
                </v-btn>
              </template>
              <span>{{ $t(actionsDetails[actions.COPY_MAIL].text) }}</span>
            </v-tooltip>
            <v-tooltip v-if="filteredActions.includes(actions.DELETE)" bottom>
              <template #activator="{ on, attrs }">
                <v-btn
                  icon
                  small
                  class="action-icon action-icon--danger"
                  :aria-label="$t(actionsDetails[actions.DELETE].text)"
                  v-bind="attrs"
                  v-on="on"
                  @click="displayDeleteModal(item)"
                >
                  <lucide-trash2 :size="18" />
                </v-btn>
              </template>
              <span>{{ $t(actionsDetails[actions.DELETE].text) }}</span>
            </v-tooltip>

            <!-- More actions menu -->
            <bs-mailings-actions-dropdown>
              <bs-mailings-actions-dropdown-item
                v-if="filteredActions.includes(actions.ADD_TAGS)"
                :icon="actionsDetails[actions.ADD_TAGS].icon"
                :on-click="() => openTagsMenu(item)"
              >
                {{ $t(actionsDetails[actions.ADD_TAGS].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                v-if="filteredActions.includes(actions.TRANSFER)"
                :icon="actionsDetails[actions.TRANSFER].icon"
                :on-click="() => transferMailing(item)"
              >
                {{ $t(actionsDetails[actions.TRANSFER].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                :icon="actionsDetails[actions.PREVIEW].icon"
                :on-click="() => openPreviewMail(item)"
              >
                {{ $t(actionsDetails[actions.PREVIEW].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                v-if="filteredActions.includes(actions.MOVE_MAIL)"
                :icon="actionsDetails[actions.MOVE_MAIL].icon"
                :on-click="() => openMoveMail(item)"
              >
                {{ $t(actionsDetails[actions.MOVE_MAIL].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                v-if="filteredActions.includes(actions.DUPLICATE_TRANSLATE)"
                :icon="actionsDetails[actions.DUPLICATE_TRANSLATE].icon"
                :on-click="() => openDuplicateTranslateModal(item)"
              >
                {{ $t(actionsDetails[actions.DUPLICATE_TRANSLATE].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                v-if="filteredActions.includes(actions.DOWNLOAD)"
                :icon="actionsDetails[actions.DOWNLOAD].icon"
                :on-click="
                  () => handleDownloadMail({ mailing: item, isWithFtp: false })
                "
              >
                {{ $t(actionsDetails[actions.DOWNLOAD].text) }}
              </bs-mailings-actions-dropdown-item>
              <bs-mailings-actions-dropdown-item
                v-if="
                  filteredActions.includes(actions.DOWNLOAD_FTP) && hasFtpAccess
                "
                :icon="actionsDetails[actions.DOWNLOAD_FTP].icon"
                :on-click="
                  () => handleDownloadMail({ mailing: item, isWithFtp: true })
                "
              >
                {{ $t(actionsDetails[actions.DOWNLOAD_FTP].text) }}
              </bs-mailings-actions-dropdown-item>
            </bs-mailings-actions-dropdown>
          </div>
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

      <!-- Pagination -->
      <div v-if="showPagination" class="table-pagination">
        <v-pagination
          v-model="localPage"
          :length="totalPages"
          :total-visible="7"
          circle
        />
      </div>

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
              name: selectedMailing.name,
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

<style lang="scss">
/* Table styling - NOT scoped to ensure Vuetify overrides work */
.mailings-table-wrapper {
  .v-data-table {
    border: 1px solid rgba(0, 0, 0, 0.12);
    border-radius: 4px;
    overflow: hidden;

    // Table header styling
    thead th {
      background: #fafafa !important;
      font-size: 0.75rem !important;
      font-weight: 600 !important;
      color: rgba(0, 0, 0, 0.6) !important;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid rgba(0, 0, 0, 0.12) !important;
      height: 48px !important;
    }

    // Row styling
    tbody tr {
      transition: background-color 0.15s ease;

      &:hover {
        background-color: rgba(0, 172, 220, 0.08) !important;
      }

      td {
        font-size: 0.875rem;
        height: 52px !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.06) !important;
      }

      &:last-child td {
        border-bottom: none !important;
      }
    }

    // Footer styling
    .v-data-footer {
      border-top: 1px solid rgba(0, 0, 0, 0.12);
      font-size: 0.75rem;
    }
  }

  // Comment badge styling
  .v-badge__badge {
    font-size: 10px;
    height: 18px;
    min-width: 18px;
    padding: 0 5px;
  }
}
</style>

<style lang="scss" scoped>
.v-list {
  cursor: pointer;
}

.mw18 {
  max-width: 18rem;
}

/* Actions cell with quick icons */
.actions-cell {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.action-icon {
  color: rgba(0, 0, 0, 0.54);
  text-decoration: none;
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    color: var(--v-primary-base);
    background-color: rgba(0, 0, 0, 0.04);
  }

  &--danger:hover {
    color: var(--v-error-base, #ff5252);
  }
}

/* Email link styling */
.email-link {
  color: var(--v-primary-base, #00acdc) !important;
  text-decoration: none;
  font-weight: 500;

  &:hover {
    text-decoration: underline;
  }
}

/* Tags styling */
.tags {
  display: inline-block;
  padding: 2px 8px;
  margin: 2px 4px 2px 0;
  background: rgba(0, 172, 220, 0.1);
  color: var(--v-primary-base);
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: 500;
}

/* Pagination styling */
.table-pagination {
  display: flex;
  justify-content: center;
  padding: 1rem 0;
  border-top: 1px solid rgba(0, 0, 0, 0.06);
  margin-top: -1px;

  ::v-deep {
    .v-pagination__item,
    .v-pagination__navigation {
      box-shadow: none;
    }

    .v-pagination__item--active {
      background-color: var(--v-primary-base) !important;
    }
  }
}

/* Empty state styling */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  color: rgba(0, 0, 0, 0.38);

  &__icon {
    margin-bottom: 1rem;
    opacity: 0.5;
  }

  &__text {
    margin: 0;
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.6);
  }
}
</style>
