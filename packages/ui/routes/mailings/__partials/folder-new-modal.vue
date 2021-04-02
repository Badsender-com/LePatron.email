<script>
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import BsModalConfirm from '~/components/modal-confirm';

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
      nameRule: (v) => !!v || this.$t('forms.workspace.inputError'),
      maxLength: (value) =>
        value.length <= 70 || this.$t('forms.workspace.inputMaxLength'),
    };
  },
  computed: {
    destinationLabel() {
      return `${this.$t('global.parentLocation')} :`;
    },
    isValidToCreate() {
      return !!this.folderName;
    },
  },
  methods: {
    open() {
      this.$refs.createNewFolderModal.open();
    },
    close() {
      this.$refs.form.reset();
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
        counter
        :label="this.$t('folders.name')"
        required
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn :disabled="!isValidToCreate" type="submit" color="primary">
          {{ $t('global.newFolder') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
