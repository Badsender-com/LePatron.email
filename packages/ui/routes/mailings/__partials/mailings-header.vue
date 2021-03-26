<script>
import MailingsBreadcrumbs from '~/routes/mailings/__partials/mailings-breadcrumbs';
import FolderNewModal from '~/routes/mailings/__partials/folder-new-modal';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';

export default {
  name: 'MailingsHeader',
  components: {
    MailingsBreadcrumbs,
    FolderNewModal,
  },
  mixins: [mixinCurrentLocation],
  props: {
    loadingParent: { type: Boolean, default: false },
  },
  methods: {
    openNewFolderModal() {
      this.$refs.folderNewModalRef.open();
    },
    createNewFolder() {
      this.$refs.folderNewModalRef.open();
    },
  },
};
</script>
<template>
  <div>
    <v-toolbar flat>
      <v-toolbar-title>
        <mailings-breadcrumbs />
      </v-toolbar-title>
      <v-spacer />
      <div class="pa-2">
        <v-btn
          class="my-4 new-mail-button"
          color="primary"
          tile
          :disabled="!hasAccess"
          @click="openNewFolderModal"
        >
          <v-icon left>
            create_new_folder
          </v-icon>
          {{ $t('global.newFolder') }}
        </v-btn>
      </div>
    </v-toolbar>
    <folder-new-modal
      ref="folderNewModalRef"
      :create-new-folder="createNewFolder"
      :loading-parent="loadingParent"
    />
  </div>

  <!--  <div class="d-flex align-center mb-2">-->
  <!--    <div class="font-weight-bold">-->
  <!--      <mailings-breadcrumbs />-->
  <!--    </div>-->
  <!--    -->
  <!--  </div>-->
</template>
