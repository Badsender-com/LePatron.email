<script>
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import BsModalConfirm from '~/components/modal-confirm';
import { FOLDER_NAME_MAX_LENGTH } from '~/helpers/constants/folders.js';

export default {
  name: 'FolderNewModal',
  components: {
    BsModalConfirm,
    MailingsBreadcrumbs,
  },
  props: {
    conflictError: { type: Boolean, default: false },
    loadingParent: { type: Boolean, default: false },
  },
  data() {
    return {
      folderName: '',
      folderNameMaxLength: FOLDER_NAME_MAX_LENGTH,
      nameRule: (v) => !!v || this.$t('forms.workspace.inputError'),
      maxLength: (value) =>
        (value || '').length <= FOLDER_NAME_MAX_LENGTH ||
        this.$t('forms.workspace.inputMaxLength'),
    };
  },
  computed: {
    destinationLabel() {
      return `${this.$t('global.parentLocation')} :`;
    },
    isValidToCreate() {
      return (
        !!this.folderName && this.folderName?.length <= FOLDER_NAME_MAX_LENGTH
      );
    },
  },
  methods: {
    open() {
      this.folderName = '';
      this.$refs.form?.resetValidation();
      this.$refs.createNewFolderModal.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.createNewFolderModal.close();
    },
    async submit() {
      this.$refs.form.validate();
      if (this.isValidToCreate) {
        await this.$emit('create-new-folder', {
          folderName: this.folderName,
        });
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="createNewFolderModal"
    modal-width="700"
    :title="$t('global.newFolder')"
    :is-form="true"
    @click:outside="close"
  >
    <v-form ref="form" @submit.prevent="submit">
      <div class="d-flex flex-column mb-2">
        <div class="font-weight-bold">
          {{ destinationLabel }}
        </div>
        <div>
          <mailings-breadcrumbs :large="false" />
        </div>
      </div>
      <p v-if="conflictError" class="red--text">
        {{ $t('folders.conflict') }}
      </p>
      <v-text-field
        v-model="folderName"
        class="pt-1"
        :rules="[nameRule, maxLength]"
        :counter="folderNameMaxLength"
        :label="this.$t('folders.name')"
        required
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          :disabled="!isValidToCreate"
          elevation="0"
          type="submit"
          color="accent"
        >
          {{ $t('global.newFolder') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
