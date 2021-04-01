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
      folderName: '',
      nameRule: [(v) => !!v || this.$t('forms.workspace.inputError')],
    };
  },
  computed: {
    isValidToRename() {
      return !!this.folderName;
    },
  },
  methods: {
    open() {
      this.$refs.createRenameFolderModal.open();
    },
    close() {
      this.$refs.form.reset();
      this.$refs.createRenameFolderModal.close();
    },
    async submit() {
      this.$refs.form.validate();
      if (this.isValidToRename) {
        await this.$emit('create-rename-folder', {
          folderName: this.folderName,
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
    :title="$t('global.renameFolder')"
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
          {{ $t('global.renameFolder') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
