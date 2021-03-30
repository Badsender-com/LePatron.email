<script>
import { folders } from '~/helpers/api-routes.js';
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
  computed: {
    hasRightToCreateFolder() {
      return !this.hasAccess || !!this.folder?._parentFolder;
    },
  },
  async mounted() {
    await this.getFolderAndWorkspaceData(this.$axios, this.$route?.query);
  },
  methods: {
    openNewFolderModal() {
      this.$refs.folderNewModalRef.open();
    },
    async createNewFolder({ folderName }) {
      try {
        await this.$axios.$post(folders(), {
          name: folderName,
          ...this.currentLocationParam,
        });
      } catch {
        this.showSnackbar({ text: 'an error as occurred', color: 'error' });
      }
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
          class="my-4 new-mail-button pl-10 pr-10"
          color="primary"
          tile
          :disabled="hasRightToCreateFolder"
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
      :loading-parent="loadingParent"
      @create-new-folder="createNewFolder"
    />
  </div>

  <!--  <div class="d-flex align-center mb-2">-->
  <!--    <div class="font-weight-bold">-->
  <!--      <mailings-breadcrumbs />-->
  <!--    </div>-->
  <!--    -->
  <!--  </div>-->
</template>
