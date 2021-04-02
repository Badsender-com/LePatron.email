<script>
import { folders, workspacesByGroup } from '~/helpers/api-routes.js';
import { getTreeviewWorkspaces } from '~/utils/workspaces';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import FolderRenameModal from '~/routes/mailings/__partials/folder-rename-modal';
import { SPACE_TYPE } from '~/helpers/constants/space-type';

export default {
  name: 'WorkspaceTree',
  components: { FolderRenameModal },
  mixins: [mixinCurrentLocation],
  data: () => ({
    workspacesIsLoading: true,
    workspaceIsError: false,
    workspaces: [],
    conflictError: false,
  }),
  computed: {
    treeviewLocationItems() {
      return getTreeviewWorkspaces(this.workspaces);
    },
    selectedItem() {
      return { id: this.currentLocation };
    },
  },
  async mounted() {
    await this.fetchData();
    if (!this.selectedItem?.id && this.workspaces?.length > 0) {
      await this.$router.push({
        query: { wid: this.workspaces[0]?.id },
      });
    }
  },
  methods: {
    async fetchData() {
      const { $axios, $route } = this;
      try {
        this.workspacesIsLoading = true;
        await this.getFolderAndWorkspaceData($axios, $route.query);
        const { items } = await $axios.$get(workspacesByGroup());
        this.workspaces = items;
      } catch (error) {
        this.workspaceIsError = true;
      } finally {
        this.workspacesIsLoading = false;
      }
    },
    checkIfAuthorizedMenu(item) {
      return this.hasAccess && item?.type === SPACE_TYPE.FOLDER;
    },
    handleSelectItemFromTreeView(selectedItems) {
      if (selectedItems[0]?.id) {
        let querySelectedElement = null;
        if (selectedItems[0]?.type === SPACE_TYPE.WORKSPACE) {
          querySelectedElement = {
            wid: selectedItems[0].id,
          };
        } else {
          querySelectedElement = {
            fid: selectedItems[0].id,
          };
        }
        this.$router.push({
          query: querySelectedElement,
        });
      }
    },
    openRenameFolderModal() {
      this.$refs.modalRenameFolderDialog.open();
    },
    async handleRenameFolder({ folderName, folderId }) {
      console.log({ folderName, folderId });
      try {
        await this.$axios.$put(folders(), {
          name: folderName,
          folderId,
        });
        this.$emit('on-refresh');
        this.conflictError = false;
        this.showSnackbar({
          text: this.$t('folders.nameUpdated'),
          color: 'success',
        });

        this.$refs.modalRenameFolderDialog.close();
      } catch (error) {
        if (error?.response?.status === 409) {
          this.conflictError = true;
        }
        this.showSnackbar({
          text: this.$t('global.errors.error'),
          color: 'error',
        });
      }
    },
  },
};
</script>

<template>
  <v-skeleton-loader
    type="list-item, list-item, list-item"
    :loading="workspacesIsLoading"
  >
    <v-treeview
      ref="tree"
      item-key="id"
      activatable
      :active="[selectedItem]"
      :items="treeviewLocationItems"
      hoverable
      open-all
      return-object
      class="pb-8"
      @update:active="handleSelectItemFromTreeView"
    >
      <template #prepend="{ item, open }">
        <v-icon v-if="!item.icon" :color="item.hasAccess ? 'primary' : 'base'">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else :color="item.hasAccess ? 'primary' : 'base'">
          {{ item.icon }}
        </v-icon>
      </template>
      <template #label="{ item, active }">
        <div @click="active ? $event.stopPropagation() : null">
          {{ item.name }}
        </div>
      </template>
      <template #append="{ item }">
        <v-menu v-if="checkIfAuthorizedMenu(item)" bottom left>
          <template #activator="{ on, attrs }">
            <v-btn icon v-bind="attrs" v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>

          <v-list>
            <v-list-item link @click="openRenameFolderModal(item)">
              <v-list-item-title>{{ $t('folders.rename') }} </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-treeview>
    <folder-rename-modal
      ref="modalRenameFolderDialog"
      :conflict-error="conflictError"
      :loading-parent="loading"
      @rename-folder="handleRenameFolder"
    />
  </v-skeleton-loader>
</template>

<style scoped>
.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

.v-treeview {
  overflow-y: auto;
}
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
</style>
