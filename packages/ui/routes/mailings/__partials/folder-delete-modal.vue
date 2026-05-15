<script>
import BsModalConfirmForm from '~/components/modal-confirm-form';
import { Trash2 } from 'lucide-vue';
import { escapeHtml } from '~/helpers/escape-html';

export default {
  name: 'FolderDeleteModal',
  components: {
    BsModalConfirmForm,
    LucideTrash2: Trash2,
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
    submit() {
      this.$emit('delete-folder', this.selectedFolder);
    },
    escapeHtml,
  },
};
</script>

<template>
  <bs-modal-confirm-form
    ref="deleteDialog"
    :with-input-confirmation="false"
    :confirm-check-box="false"
    :confirm-check-box-message="$t('groups.mailingTab.deleteFolderNotice')"
    @confirm="submit"
  >
    <template #titlePrefix>
      <lucide-trash2 :size="20" />
    </template>
    <p
      class="black--text"
      v-html="
        $t('groups.mailingTab.deleteFolderWarning', {
          name: escapeHtml(selectedFolder.name),
        })
      "
    />
  </bs-modal-confirm-form>
</template>
