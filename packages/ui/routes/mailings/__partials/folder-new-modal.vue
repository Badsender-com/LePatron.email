<script>
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import BsModalConfirm from '~/components/modal-confirm';
import { FOLDER_NAME_MAX_LENGTH } from '~/helpers/constants/folders.js';
import { SPACE_TYPE } from '~/helpers/constants/space-type';

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
      folderOrWorkspace: { type: Object, default: null },
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
    currentParentFolderParam() {
      if (this.folderOrWorkspace?.type === SPACE_TYPE.WORKSPACE) {
        return { workspaceId: this.folderOrWorkspace?.id };
      }
      if (this.folderOrWorkspace?.type === SPACE_TYPE.FOLDER) {
        return { parentFolderId: this.folderOrWorkspace?.id };
      }
      return {};
    },
  },
  methods: {
    open(folderOrWorkspace) {
      this.folderName = '';
      if (folderOrWorkspace) {
        this.folderOrWorkspace = folderOrWorkspace;
      }
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
          workspaceOrFolderParam: this.currentParentFolderParam,
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
      <div class="d-flex align-center mb-2">
        <div class="font-weight-bold">
          {{ destinationLabel }}
        </div>
        <div class="pa-2">
          <mailings-breadcrumbs :workspace-or-folder-item="folderOrWorkspace" />
        </div>
      </div>
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
