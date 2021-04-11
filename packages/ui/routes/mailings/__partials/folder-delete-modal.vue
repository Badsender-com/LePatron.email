<script>
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { getFolderContentStatus } from '~/helpers/api-routes';

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
      hasContent: true,
    };
  },
  methods: {
    async fetchContent() {
      const contentResponse = await this.$axios.get(
        getFolderContentStatus(this.selectedFolder?.id)
      );
      this.hasContent = contentResponse?.data?.hasContent;
    },
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
    :confirm-check-box="hasContent"
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
