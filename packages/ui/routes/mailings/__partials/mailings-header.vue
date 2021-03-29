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
  computed: {},
  async mounted() {
    await this.getFolderAndWorkspaceData(this.$axios, this.$route?.query);
  },
  methods: {
    openNewFolderModal() {
      this.$refs.folderNewModalRef.open();
    },
    createNewFolder(data) {
      console.log('createNewFolder');
      console.log(this.currentLocationParam);
      console.log(data);
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
          :disabled="false"
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
