<script>
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'MailingsDownloadModal',
  components: {
    BsModalConfirm,
  },
  props: {
    selectionLength: { type: Number, default: 0 },
    mailingsSelection: { type: Array, default: () => [] },
  },
  data: () => ({
    isDownloadFtp: false,
  }),

  methods: {
    open(isDownloadFtp) {
      this.isDownloadFtp = isDownloadFtp;
      this.$refs.downloadSelectionDialog.open();
      console.log({ mailingsSelection: this.mailingsSelection });
    },
    close() {
      this.$refs.downloadSelectionDialog.close();
    },
    submit() {
      this.$emit('confirm', this.isDownloadFtp);
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="downloadSelectionDialog"
    :title="
      isDownloadFtp
        ? $tc('mailings.downloadFtpCount', selectionLength, {
          count: selectionLength,
        })
        : $tc('mailings.downloadCount', selectionLength, {
          count: selectionLength,
        })
    "
    :action-label="$t('global.continue')"
    action-button-color="success"
    @confirm="submit"
  >
    <v-alert dense border="left" type="warning" icon="mdi-alert-outline">
      {{ $t('mailings.downloadManyMailsWithoutPreview') }}
      <!-- TODO add condition to display only mails which have preview -->
      <li v-for="mail in mailingsSelection" :key="mail.id">
        {{ mail.name }}
      </li>
    </v-alert>
  </bs-modal-confirm>
</template>
