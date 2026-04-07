<script>
import BsModalConfirm from '~/components/modal-confirm';
import { AlertTriangle } from 'lucide-vue';

export default {
  name: 'MailingsDownloadModal',
  components: {
    BsModalConfirm,
    LucideAlertTriangle: AlertTriangle,
  },
  data: () => ({
    isDownloadFtp: false,
    mailingsSelection: [],
    mailsWithoutPreviewSelection: [],
  }),
  computed: {
    selectionLength() {
      return this.mailingsSelection?.length;
    },
    modalTitle() {
      if (this.isSingleMail) {
        return this.$tc('global.download');
      } else {
        return this.isDownloadFtp
          ? this.$tc('mailings.downloadFtpCount', this.selectionLength, {
              count: this.selectionLength,
            })
          : this.$tc('mailings.downloadCount', this.selectionLength, {
              count: this.selectionLength,
            });
      }
    },
    isSingleMail() {
      return (
        this.mailingsSelection.length +
          (this.mailsWithoutPreviewSelection
            ? this.mailsWithoutPreviewSelection.length
            : 0) ===
        1
      );
    },
    modalText() {
      return this.isSingleMail
        ? this.$t('mailings.downloadSingleMailWithoutPreview')
        : this.$t('mailings.downloadManyMailsWithoutPreview');
    },
  },
  methods: {
    open({ isWithFtp, mailingIds, mailsWithoutPreviewSelection }) {
      this.mailingsSelection = mailingIds;
      this.isDownloadFtp = isWithFtp;

      if (mailsWithoutPreviewSelection) {
        this.mailsWithoutPreviewSelection = mailsWithoutPreviewSelection;
      }

      this.$refs.downloadSelectionDialog.open();
    },
    close() {
      this.mailsWithoutPreviewSelection = 0;
    },
    submit() {
      this.mailsWithoutPreviewSelection = 0;
      this.$emit('confirm', {
        isWithFtp: this.isDownloadFtp,
        mailingIds: this.mailingsSelection,
      });
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="downloadSelectionDialog"
    :title="modalTitle"
    :action-label="$t('global.continue')"
    action-button-color="success"
    :display-submit-button="!isSingleMail"
    @close="close"
    @click-outside="close"
    @confirm="submit"
  >
    <v-card class="d-flex flex-row align-center mb-3" flat tile>
      <lucide-alert-triangle :size="24" class="warning-icon" />
      <p class="mb-0 ml-3">
        {{ modalText }}
      </p>
    </v-card>
    <v-card v-if="!isSingleMail" class="mb-3 pl-6" flat tile>
      <ul>
        <li v-for="mail in mailsWithoutPreviewSelection" :key="mail.id">
          {{ mail.name }}
        </li>
      </ul>
    </v-card>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.warning-icon {
  color: #f57c00; /* orange darken-2 equivalent */
  flex-shrink: 0;
}
</style>
