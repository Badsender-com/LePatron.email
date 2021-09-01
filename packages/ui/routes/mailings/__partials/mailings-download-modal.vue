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
  computed: {
    modalTitle() {
      return this.isDownloadFtp
        ? this.$tc('mailings.downloadFtpCount', this.selectionLength, {
            count: this.selectionLength,
          })
        : this.$tc('mailings.downloadCount', this.selectionLength, {
            count: this.selectionLength,
          });
    },
  },
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
    :title="modalTitle"
    :action-label="$t('global.continue')"
    action-button-color="success"
    @confirm="submit"
  >
    <v-card class="d-flex flex-row align-center mb-3" flat>
      <v-icon color="#f57c00">
        warning_amber
      </v-icon>
      <p class="mb-0 ml-3">
        {{ $t('mailings.downloadManyMailsWithoutPreview') }}
      </p>
    </v-card>
    <!-- TODO add condition to display only mails which have preview -->
    <v-card class="mb-3 pl-6" flat>
      <ul>
        <li v-for="mail in mailingsSelection" :key="mail.id">
          {{ mail.name }}
        </li>
      </ul>
    </v-card>
  </bs-modal-confirm>
</template>
