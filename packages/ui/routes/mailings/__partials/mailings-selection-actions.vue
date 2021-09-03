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

export default {
  name: 'MailingsSelectionActions',
  components: {
    ModalMoveMail,
    BsModalConfirm,
    MailingsTagsMenu,
    MailingsDownloadModal,
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
      const allHavePreview = this.mailsWithoutPreviewSelection?.length <= 0;
      this.handleInitDownload({
        isWithFtp,
        mailingIds: filteredMailingsIds,
        havePreview: allHavePreview,
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
    <v-alert v-if="hasSelection" text dense color="info">
      <div class="bs-mailing-selection-actions">
        <span class="bs-mailing-selection-actions__count">{{
          $tc('mailings.selectedCount', selectionLength, {
            count: selectionLength,
          })
        }}</span>

        <div class="bs-mailing-selection-actions__actions">
          <v-tooltip bottom>
            <template v-if="hasFtpAccess" #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="handleInitMultipleDownload({ isWithFtp: true })"
              >
                <v-icon>mdi-cloud-download</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.downloadFtpCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="handleInitMultipleDownload({ isWithFtp: false })"
              >
                <v-icon>download</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.downloadCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
          <mailings-tags-menu
            :tags="tags"
            :mailings-selection="mailingsSelection"
            @create="$emit(`createTag`, $event)"
            @update="$emit(`updateTags`, $event)"
          />
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="openMoveManyMailsDialog"
              >
                <v-icon>drive_file_move</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.moveCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
          <v-tooltip bottom>
            <template #activator="{ on }">
              <v-btn
                icon
                color="info"
                v-on="on"
                @click="openDeleteSelectionModal"
              >
                <v-icon>delete</v-icon>
              </v-btn>
            </template>
            <span>{{
              $tc('mailings.deleteCount', selectionLength, {
                count: selectionLength,
              })
            }}</span>
          </v-tooltip>
        </div>
      </div>
    </v-alert>
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
.bs-mailing-selection-actions {
  display: flex;
  align-items: center;
}
.bs-mailing-selection-actions__count {
  margin-right: auto;
}
</style>
