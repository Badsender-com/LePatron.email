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
    loadingParent: { type: Boolean, default: false },
  },
  data() {
    return {
      folderName: '',
      nameRule: [(v) => !!v || this.$t('forms.workspace.inputError')],
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
      console.log('submit');
      this.$refs.form.validate();
      console.log(this.isValidToCreate);
      if (this.isValidToCreate) {
        await this.$emit('create-new-folder', {
          folderName: this.folderName,
        });
        if (!this.loadingParent) {
          this.close();
        }
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
      <div class="d-flex align-center mb-2">
        <div class="font-weight-bold">
          {{ destinationLabel }}
        </div>
        <div class="pa-2">
          <mailings-breadcrumbs />
        </div>
      </div>

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
        <v-btn :disabled="!isValidToCreate" type="submit" color="primary">
          {{ $t('global.newFolder') }}
        </v-btn>
      </v-card-actions>
    </v-form>
  </bs-modal-confirm>
</template>
