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
      hasContent: true,
    };
  },
  methods: {
    async fetchContent() {
      this.hasContent = await this.$axios.get({});
    },
    open(folder) {
      this.selectedFolder = folder;
      this.$refs.deleteDialog.open();
    },
    close() {
      this.$refs.form?.reset();
      this.$refs.deleteDialog.close();
    },
    async submit() {
      this.$refs.form.validate();
      if (this.isValidToDelete) {
        await this.$emit('delete-folder', {
          folder: this.selectedFolder,
        });
      }
    },
  },
};
</script>

<template>
  <bs-modal-confirm-form
    ref="deleteDialog"
    :with-input-confirmation="false"
    :confirm-check-box="hasContent"
    :confirm-check-box-message="$t('groups.mailingTab.deleteFolderNotice')"
    @confirm="submit"
  >
    <p
      class="black--text"
      v-html="
        $t('groups.mailingTab.deleteFolderWarning', {
          name: selectedItemToDelete.name,
        })
      "
    />
  </bs-modal-confirm-form>
</template>
