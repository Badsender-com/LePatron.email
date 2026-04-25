<script>
import ModalMoveMail from '~/routes/mailings/__partials/mailings-move-modal';
import MailingsDownloadModal from '~/routes/mailings/__partials/mailings-download-modal';
import BsModalConfirm from '~/components/modal-confirm';
import MailingsTagsMenu from '~/components/mailings/tags-menu.vue';
import {
  moveManyMails,
  mailingsItem,
  downloadMultipleMails,
} from '~/helpers/api-routes';
import { mapMutations } from 'vuex';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { CloudDownload, Download, FolderInput, Trash2 } from 'lucide-vue';

export default {
  name: 'MailingsSelectionActions',
  components: {
    ModalMoveMail,
    BsModalConfirm,
    MailingsTagsMenu,
    MailingsDownloadModal,
    LucideCloudDownload: CloudDownload,
    LucideDownload: Download,
    LucideFolderInput: FolderInput,
    LucideTrash2: Trash2,
  },
  props: {
    mailingsSelection: { type: Array, default: () => [] },
    tags: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
    hasFtpAccess: { type: Boolean, default: false },
  },
  data() {
    return {
      deleteDialog: false,
      downloadDialog: false,
    };
  },
  computed: {
    selectionLength() {
      return this.mailingsSelection.length;
    },
    hasSelection() {
      return this.selectionLength > 0;
    },
    mailsWithoutPreviewSelection() {
      return this.mailingsSelection.filter(
        (mail) => mail.hasHtmlPreview === false
      );
    },
  },
  methods: {
    ...mapMutations(PAGE, { showSnackbar: SHOW_SNACKBAR }),
    openMoveManyMailsDialog() {
      this.$refs.moveManyMailsDialog.open({
        workspace: {
          id: this.workspace?.id,
        },
      });
    },

    async handleDownloadEmail({ isWithFtp, mailingIds }) {
      const downloadOptions = {
        downLoadForCdn: false,
        downLoadForFtp: isWithFtp,
      };

      return this.$axios
        .$post(
          downloadMultipleMails(),
          {
            mailingIds,
            downloadOptions,
          },
          {
            responseType: 'blob',
          }
        )
        .then((response) => {
          const blob = new Blob([response]);
          const url = window.URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.setAttribute('download', 'lepatron.zip');
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
    },

    openDeleteSelectionModal() {
      this.$refs.deleteSelectionDialog.open();
    },
    closeMoveManyMailsDialog() {
      this.$refs.moveManyMailsDialog.close();
    },
    async handleMultipleDelete() {
      const { $route } = this;
      try {
        const mailSelectionDeletionPromises = this.mailingsSelection.map(
          (mailing) =>
            this.$axios.$delete(mailingsItem({ mailingId: mailing.id }), {
              data: {
                workspaceId: $route.query.wid,
                parentFolderId: $route.query.fid,
              },
            })
        );
        await Promise.all(mailSelectionDeletionPromises);

        this.$emit('on-refetch');
        this.showSnackbar({
          text: this.$t('mailings.deleteManySuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      }
    },
    async moveManyMails({ destinationParam }) {
      try {
        await this.$axios.$post(moveManyMails(), {
          mailingsIds: this.mailingsSelection?.map((mail) => mail?.id),
          ...destinationParam,
        });

        const queryParam = destinationParam?.parentFolderId
          ? { fid: destinationParam.parentFolderId }
          : { wid: destinationParam.workspaceId };

        this.$router.push({
          query: queryParam,
        });

        this.showSnackbar({
          text: this.$t('mailings.moveManySuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
      this.closeMoveManyMailsDialog();
    },
    handleInitDownload({
      isWithFtp,
      mailingIds,
      havePreview,
      mailsWithoutPreviewSelection,
    }) {
      if (havePreview) {
        this.handleDownloadMailSelections({ isWithFtp, mailingIds });
        return;
      }
      this.$refs.downloadMailsDialog.open({
        isWithFtp,
        mailingIds,
        mailsWithoutPreviewSelection,
      });
    },
    handleInitSingleDownload({ isWithFtp, mailing }) {
      const mailingIds = [mailing.id];
      const havePreview = mailing.hasHtmlPreview;
      this.handleInitDownload({ isWithFtp, mailingIds, havePreview });
    },
    handleInitMultipleDownload({ isWithFtp }) {
      const filteredMailingsIds = this.mailingsSelection
        .filter((mail) => !this.mailsWithoutPreviewSelection.includes(mail))
        ?.map((mail) => mail?.id);
      const doesAllHavePreview = this.mailsWithoutPreviewSelection?.length <= 0;
      this.handleInitDownload({
        isWithFtp,
        mailingIds: filteredMailingsIds,
        havePreview: doesAllHavePreview,
        mailsWithoutPreviewSelection: this.mailsWithoutPreviewSelection,
      });
    },
    async handleDownloadMailSelections({ isWithFtp, mailingIds }) {
      try {
        await this.handleDownloadEmail({
          isWithFtp: isWithFtp,
          mailingIds: mailingIds,
        });
        this.showSnackbar({
          text: this.$t('mailings.downloadManySuccessful'),
          color: 'success',
        });
      } catch (err) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <div>
    <!-- BsDataTable bulk bar (design system spec) -->
    <div v-if="hasSelection" class="bsdt-bulkbar">
      <span class="bsdt-bulkbar__count">
        <strong>{{ selectionLength }}</strong>
        {{ $tc('mailings.selectedMailings', selectionLength) }}
        <button class="bsdt-bulkbar__clear" @click="$emit('clear-selection')">
          {{ $t('global.clear') }}
        </button>
      </span>

      <div class="bsdt-bulkbar__actions">
        <!-- FTP Download -->
        <v-tooltip v-if="hasFtpAccess" bottom>
          <template #activator="{ on }">
            <button
              class="bsdt-bulkbar__btn"
              v-on="on"
              @click="handleInitMultipleDownload({ isWithFtp: true })"
            >
              <lucide-cloud-download :size="13" />
              {{ $t('mailings.downloadFtp') }}
            </button>
          </template>
          <span>{{
            $tc('mailings.downloadFtpCount', selectionLength, {
              count: selectionLength,
            })
          }}</span>
        </v-tooltip>

        <!-- Download -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <button
              class="bsdt-bulkbar__btn"
              v-on="on"
              @click="handleInitMultipleDownload({ isWithFtp: false })"
            >
              <lucide-download :size="13" />
              {{ $t('global.download') }}
            </button>
          </template>
          <span>{{
            $tc('mailings.downloadCount', selectionLength, {
              count: selectionLength,
            })
          }}</span>
        </v-tooltip>

        <!-- Tags menu (keep as is for now) -->
        <mailings-tags-menu
          :tags="tags"
          :mailings-selection="mailingsSelection"
          @create="$emit(`createTag`, $event)"
          @update="$emit(`updateTags`, $event)"
        />

        <!-- Move -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <button
              class="bsdt-bulkbar__btn"
              v-on="on"
              @click="openMoveManyMailsDialog"
            >
              <lucide-folder-input :size="13" />
              {{ $t('global.move') }}
            </button>
          </template>
          <span>{{
            $tc('mailings.moveCount', selectionLength, {
              count: selectionLength,
            })
          }}</span>
        </v-tooltip>

        <!-- Divider before destructive action -->
        <span class="bsdt-bulkbar__divider" />

        <!-- Delete (danger) -->
        <v-tooltip bottom>
          <template #activator="{ on }">
            <button
              class="bsdt-bulkbar__btn bsdt-bulkbar__btn--danger"
              v-on="on"
              @click="openDeleteSelectionModal"
            >
              <lucide-trash2 :size="13" />
              {{ $t('global.delete') }}
            </button>
          </template>
          <span>{{
            $tc('mailings.deleteCount', selectionLength, {
              count: selectionLength,
            })
          }}</span>
        </v-tooltip>
      </div>
    </div>
    <bs-modal-confirm
      ref="deleteSelectionDialog"
      :title="
        $tc('mailings.deleteCount', selectionLength, {
          count: selectionLength,
        })
      "
      :action-label="$t('global.delete')"
      action-button-color="error"
      @confirm="handleMultipleDelete"
    >
      <p
        class="black--text"
        v-html="$t('mailings.deleteConfirmationMessage')"
      />
    </bs-modal-confirm>
    <modal-move-mail
      ref="moveManyMailsDialog"
      :is-moving-many-mails="true"
      :confirmation-title-label="`${this.$t(
        'global.moveManyMail'
      )} (${selectionLength})`"
      @confirm="moveManyMails"
    >
      <p
        class="black--text"
        v-html="$t('mailings.moveMailConfirmationMessage')"
      />
    </modal-move-mail>
    <mailings-download-modal
      ref="downloadMailsDialog"
      @confirm="handleDownloadMailSelections"
    />
  </div>
</template>

<style lang="scss" scoped>
/* =========================================================================
   BsDataTable Bulk Bar — LePatron Design System v1.0
   Based on: /tmp/lepatron-design-v2/project/preview/components-data-table.html
   ========================================================================= */

.bsdt-bulkbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  min-height: 44px;
  background: rgba(0, 172, 220, 0.06); // Accent tint
  border-bottom: 1px solid rgba(0, 172, 220, 0.18);
  color: var(--v-primary-base);
}

.bsdt-bulkbar__count {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 500;

  strong {
    font-weight: 600;
    color: var(--v-primary-base);
  }
}

.bsdt-bulkbar__clear {
  background: transparent;
  border: none;
  color: #0095c0; // --v-accent-darken1
  font-size: 12px;
  cursor: pointer;
  font-family: inherit;
  text-decoration: underline;
  padding: 0;

  &:hover {
    color: #007a9f;
  }
}

.bsdt-bulkbar__actions {
  margin-left: auto;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.bsdt-bulkbar__btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.12); // --gray-300
  border-radius: 4px; // --r-sm
  font-size: 12px;
  color: rgba(0, 0, 0, 0.7); // --gray-800
  cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease-out, border 0.15s ease-out;

  &:hover {
    background: rgba(0, 0, 0, 0.04); // --gray-100
    border-color: rgba(0, 0, 0, 0.2); // --gray-400
  }

  &--danger {
    color: #f04e23; // --color-error

    &:hover {
      background: rgba(240, 78, 35, 0.08);
      border-color: rgba(240, 78, 35, 0.4);
    }
  }
}

.bsdt-bulkbar__divider {
  width: 1px;
  height: 18px;
  background: rgba(0, 172, 220, 0.25);
  margin: 0 4px;
}
</style>
