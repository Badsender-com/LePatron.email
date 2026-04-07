<script>
import BsModalConfirm from '~/components/modal-confirm';
import { FOLDER_NAME_MAX_LENGTH } from '~/helpers/constants/folders.js';

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
      folderNameMaxLength: FOLDER_NAME_MAX_LENGTH,
      nameRule: (v) => !!v || this.$t('forms.workspace.inputError'),
      maxLength: (value) =>
        (value || '').length <= FOLDER_NAME_MAX_LENGTH ||
        this.$t('forms.workspace.inputMaxLength'),
    };
  },
  computed: {
    titleRenameModal() {
      return this.$t('folders.renameTitle', {
        name: this.selectedFolder?.name,
      });
    },
    isValidToRename() {
      return (
        !!this.folderName && this.folderName?.length <= FOLDER_NAME_MAX_LENGTH
      );
    },
  },
  methods: {
    open(folder) {
      this.selectedFolder = folder;
      this.folderName = folder?.name || '';
      this.$refs.form?.resetValidation();
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
      <label class="form-label">
        {{ $t('folders.name') }}
        <span class="form-label__required">*</span>
      </label>
      <v-text-field
        v-model="folderName"
        :rules="[nameRule, maxLength]"
        :counter="folderNameMaxLength"
        solo
        flat
        dense
        hide-details="auto"
        class="form-input"
      />
      <v-divider class="mt-4" />
      <v-card-actions>
        <v-spacer />
        <v-btn color="primary" text @click="close">
          {{ $t('global.cancel') }}
        </v-btn>
        <v-btn
          :disabled="!isValidToRename"
          elevation="0"
          type="submit"
          color="accent"
        >
          {{ $t('folders.rename') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>

<style lang="scss" scoped>
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.6);
  margin-bottom: 0.375rem;

  &__required {
    color: #f04e23;
    margin-left: 2px;
  }
}

.form-input {
  &.v-text-field.v-text-field--solo {
    ::v-deep .v-input__slot {
      border: 1px solid rgba(0, 0, 0, 0.2);
      border-radius: 4px;
      background: #fff;
      min-height: 36px;
      padding: 0 12px;
      transition: border-color 0.2s ease;

      &:hover {
        border-color: rgba(0, 0, 0, 0.4);
      }
    }

    &.v-input--is-focused ::v-deep .v-input__slot {
      border-color: var(--v-accent-base);
    }

    &.error--text ::v-deep .v-input__slot {
      border-color: #f04e23;
    }

    ::v-deep input {
      font-size: 0.875rem;
      padding: 6px 0;
    }

    ::v-deep .v-text-field__details {
      padding: 4px 0 0 0;
      min-height: auto;
    }

    ::v-deep .v-messages__message {
      font-size: 0.75rem;
    }
  }
}
</style>
