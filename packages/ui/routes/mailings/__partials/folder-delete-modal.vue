<script>
import BsModalConfirmForm from '~/components/modal-confirm-form';

export default {
  name: 'FolderDeleteModal',
  components: {
    BsModalConfirmForm,
  },
  props: {
    loadingParent: { type: Boolean, default: false },
  },
  data() {
    return {
      selectedFolder: {},
    };
  },
  methods: {
    async fetchContent() {},
    async open(folder) {
      this.selectedFolder = folder;
      await this.fetchContent();
      this.$refs.deleteDialog.open(folder);
    },
    close() {
      this.$refs.deleteDialog.close();
    },
    async submit() {
      if (this.$refs.deleteDialog.valid) {
        await this.$emit('delete-folder', this.selectedFolder);
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm-form
    ref="deleteDialog"
    :with-input-confirmation="false"
    :confirm-check-box="true"
    :confirm-check-box-message="$t('groups.mailingTab.deleteFolderNotice')"
    @confirm="submit"
  >
    <p
      class="black--text"
      v-html="
        $t('groups.mailingTab.deleteFolderWarning', {
          name: selectedFolder.name,
        })
      "
    />
  </bs-modal-confirm-form>
</template>
