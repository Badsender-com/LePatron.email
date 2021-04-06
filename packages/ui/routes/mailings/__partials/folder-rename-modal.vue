<script>
import BsModalConfirm from '~/components/modal-confirm';

export default {
  name: 'FolderRenameModal',
  components: {
    BsModalConfirm,
  },
  props: {
    conflictError: { type: Boolean, default: false },
    loadingParent: { type: Boolean, default: false },
  },
  data() {
    return {
      selectedFolder: {},
      folderName: '',
      nameRule: [(v) => !!v || this.$t('forms.workspace.inputError')],
    };
  },
  computed: {
    titleRenameModal() {
      return this.$t('folders.renameTitle', {
        name: this.selectedFolder?.name,
      });
    },
    isValidToRename() {
      return !!this.folderName;
    },
  },
  methods: {
    open(folder) {
      this.selectedFolder = folder;
      this.$refs.createRenameFolderModal.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.createRenameFolderModal.close();
    },
    async submit() {
      this.$refs.form.validate();
      if (this.isValidToRename) {
        await this.$emit('rename-folder', {
          folderName: this.folderName,
          folderId: this.selectedFolder?.id,
        });
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm
    ref="createRenameFolderModal"
    modal-width="700"
    :title="titleRenameModal"
    :is-form="true"
  >
    <v-form ref="form" @submit.prevent="submit">
      <p v-if="conflictError" class="red--text">
        {{ $t('folders.conflict') }}
      </p>
      <v-text-field
        v-model="folderName"
        class="pt-1"
        :rules="nameRule"
        :label="this.$t('folders.name')"
        required
      />
      <v-divider />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn :disabled="!isValidToRename" type="submit" color="primary">
          {{ $t('folders.rename') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
