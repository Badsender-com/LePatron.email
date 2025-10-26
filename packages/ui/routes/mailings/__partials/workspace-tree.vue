<script>
import {
  getFolder,
  deleteFolder,
  moveFolder,
  folders,
} from '~/helpers/api-routes.js';
import { mapState } from 'vuex';
import {
  FOLDER,
  SET_PAGINATION,
  FETCH_WORKSPACES,
  FETCH_FOLDER_OR_WORKSPACE,
} from '~/store/folder';
import { USER } from '~/store/user';
import { canCreateFolder } from '~/utils/workspaces';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import FolderRenameModal from './folder-rename-modal';
import FolderMoveModal from './folder-move-modal';
import FolderNewModal from '~/routes/mailings/__partials/folder-new-modal';
import FolderDeleteModal from './folder-delete-modal';
import { SPACE_TYPE } from '~/helpers/constants/space-type';

const TREE_STATE_STORAGE_KEY = 'lepatron_workspace_tree_state';

export default {
  name: 'WorkspaceTree',
  components: {
    FolderRenameModal,
    FolderDeleteModal,
    FolderMoveModal,
    FolderNewModal,
  },
  mixins: [mixinCurrentLocation],
  data: () => ({
    selectedItemToDelete: {},
    conflictError: false,
    openNodes: [],
    treeStateInitialized: false,
  }),
  async fetch() {
    const { dispatch } = this.$store;
    await dispatch(`${FOLDER}/${FETCH_FOLDER_OR_WORKSPACE}`, {
      query: this.$route.query,
      $t: this.$t,
    });
  },
  computed: {
    ...mapState(FOLDER, [
      'workspaces',
      'areLoadingWorkspaces',
      'treeviewWorkspaces',
    ]),
    ...mapState(USER, {
      userInfo: 'info',
    }),
    selectedItem() {
      return { id: this.currentLocation };
    },
    storageKey() {
      // Create unique storage key per user
      const userId = this.userInfo?.id || 'anonymous';
      return `${TREE_STATE_STORAGE_KEY}_${userId}`;
    },
  },
  watch: {
    $route: ['getFolderAndWorkspaceData', 'checkIfNotData'],
    treeviewWorkspaces: {
      handler(newWorkspaces) {
        // Initialize tree state only once when workspaces data first loads
        if (newWorkspaces && newWorkspaces.length > 0 && !this.treeStateInitialized) {
          this.initializeTreeState();
          this.treeStateInitialized = true;
        }
      },
      immediate: true,
    },
  },
  async mounted() {
    if (!this.selectedItem?.id && this.workspaces?.length > 0) {
      await this.$router.push({
        query: { wid: this.workspaces[0]?._id },
      });
    }
  },
  methods: {
    /**
     * Get all workspace IDs recursively (for default open state)
     */
    getAllWorkspaceIds(items) {
      const ids = [];
      if (!items || items.length === 0) return ids;

      items.forEach(item => {
        if (item.type === SPACE_TYPE.WORKSPACE) {
          ids.push(item.id);
        }
      });
      return ids;
    },
    /**
     * Initialize tree state - load saved state or default to all workspaces open
     */
    initializeTreeState() {
      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(this.storageKey);
          if (saved) {
            // Restore saved state
            this.openNodes = JSON.parse(saved);
          } else {
            // Default: open all workspaces (but not folders)
            this.openNodes = this.getAllWorkspaceIds(this.treeviewWorkspaces);
            // Save this default state
            this.saveTreeState();
          }
        } else {
          // No localStorage available, default to all workspaces open
          this.openNodes = this.getAllWorkspaceIds(this.treeviewWorkspaces);
        }
      } catch (error) {
        console.error('Error initializing tree state:', error);
        // Fallback to all workspaces open
        this.openNodes = this.getAllWorkspaceIds(this.treeviewWorkspaces);
      }
    },
    /**
     * Save tree expansion state to localStorage
     */
    saveTreeState() {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.storageKey, JSON.stringify(this.openNodes));
        }
      } catch (error) {
        console.error('Error saving tree state:', error);
      }
    },
    /**
     * Handle tree expansion state changes
     */
    handleTreeUpdate(openNodes) {
      this.openNodes = openNodes;
      this.saveTreeState();
    },
    async checkIfNotData() {
      if (!this.selectedItem?.id && this.workspaces?.length > 0) {
        await this.$router.push({
          query: { wid: this.workspaces[0]?._id },
        });
      }
    },
    hasRightToCreateFolder(item) {
      return item.hasAccess && canCreateFolder(item?.id, item);
    },
    openNewFolderModal(event, item) {
      event.stopPropagation();
      this.conflictError = false;
      this.$refs.folderNewModalRef.open(item);
    },
    async createNewFolder({ folderName, workspaceOrFolderParam }) {
      try {
        const folder = await this.$axios.$post(folders(), {
          name: folderName,
          ...workspaceOrFolderParam,
        });
        await this.fetchWorkspacesData();
        this.$emit('on-refresh');
        await this.$router.push({
          query: { fid: folder?._id },
        });
        this.conflictError = false;
        this.showSnackbar({
          text: this.$t('folders.created'),
          color: 'success',
        });

        this.$refs?.folderNewModalRef?.close();
      } catch (error) {
        console.error(error);
        if (error?.response?.status === 409) {
          this.conflictError = true;
          return;
        }
        this.showSnackbar({ text: 'an error as occurred', color: 'error' });
      }
    },
    async getFolderAndWorkspaceData() {
      const { dispatch, commit } = this.$store;
      await Promise.all([
        dispatch(`${FOLDER}/${FETCH_FOLDER_OR_WORKSPACE}`, {
          query: this.$route.query,
          $t: this.$t,
        }),
        commit(`${FOLDER}/${SET_PAGINATION}`, {
          page: 1,
        }),
      ]);
    },
    async fetchWorkspacesData() {
      await this.$store.dispatch(`${FOLDER}/${FETCH_WORKSPACES}`);
    },
    checkIfAuthorizedFolderMenu(item) {
      return item.hasAccess && item?.type === SPACE_TYPE.FOLDER;
    },
    checkIfAuthorizedWorkspaceMenu(item) {
      return item.hasAccess && item?.type === SPACE_TYPE.WORKSPACE;
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
    displayDeleteModal(selected) {
      this.selectedItemToDelete = selected;
      this.$refs.modalDeleteFolderDialog?.open({
        ...selected,
      });
    },
    displayMoveModal(item) {
      this.$refs.moveModal.open(item);
    },
    async handleDeleteFolder(selected) {
      const { $axios } = this;
      const { id } = selected;
      if (!id) return;
      this.loading = true;
      try {
        await $axios.$delete(deleteFolder(id));
        this.showSnackbar({
          text: this.$t('groups.mailingTab.deleteFolderSuccessful'),
          color: 'success',
        });
      } catch (error) {
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
        console.log(error);
      } finally {
        this.loading = false;
        const deletingCurrent =
          this.selectedItemToDelete.id === this.selectedItem.id;
        const deletingParentOfCurrent = this.selectedItemToDelete.children?.some(
          (child) => child.id === this.selectedItem.id
        );
        if (deletingCurrent || deletingParentOfCurrent) {
          await this.$router.replace({
            query: { wid: this.workspaces[0]?.id },
          });
        }
        await this.fetchWorkspacesData();
      }
    },
    openRenameFolderModal(folder) {
      this.conflictError = false;
      this.$refs.modalRenameFolderDialog.open(folder);
    },
    async handleRenameFolder({ folderName, folderId }) {
      try {
        await this.$axios.$patch(getFolder(folderId), {
          folderName: folderName,
        });
        await this.fetchWorkspacesData();
        this.conflictError = false;
        this.showSnackbar({
          text: this.$t('folders.nameUpdated'),
          color: 'success',
        });

        this.$refs?.modalRenameFolderDialog?.close();
      } catch (error) {
        if (error?.response?.status === 409) {
          this.conflictError = true;
          return;
        }
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      }
    },
    async onMoveFolder(params) {
      const { destinationParam, folderId } = params;
      try {
        await this.$axios.$post(moveFolder(folderId), {
          folderId,
          ...destinationParam,
        });

        let routerRedirectionParam;
        if (destinationParam?.parentFolderId) {
          routerRedirectionParam = {
            fid: destinationParam?.destinationFolderId,
          };
        } else {
          routerRedirectionParam = { wid: destinationParam?.workspaceId };
        }

        await this.$router.push({
          query: routerRedirectionParam,
        });
        this.showSnackbar({
          text: this.$t('folders.moveFolderSuccessful'),
          color: 'success',
        });
        await this.fetchWorkspacesData();
      } catch (error) {
        console.log(error);
        let errorKey = 'global.errors.errorOccured';
        if (error.response?.status === 409) {
          errorKey = 'folders.conflict';
        }
        this.showSnackbar({
          text: this.$t(errorKey),
          color: 'error',
        });
      }
      this.$refs?.moveModal?.close();
    },
  },
};
</script>

<template>
  <v-skeleton-loader
    type="list-item, list-item, list-item"
    :loading="areLoadingWorkspaces"
  >
    <v-treeview
      ref="tree"
      item-key="id"
      activatable
      :active="[selectedItem]"
      :items="treeviewWorkspaces"
      :open="openNodes"
      hoverable
      return-object
      @update:active="handleSelectItemFromTreeView"
      @update:open="handleTreeUpdate"
    >
      <template #prepend="{ item, open }">
        <v-icon v-if="!item.icon" :color="item.hasAccess ? 'accent' : 'grey'">
          {{ open ? 'mdi-folder-open' : 'mdi-folder' }}
        </v-icon>
        <v-icon v-else :color="item.hasAccess ? 'primary' : 'grey'">
          {{ item.icon }}
        </v-icon>
      </template>
      <template #label="{ item, active }">
        <div @click="active ? $event.stopPropagation() : null">
          {{ item.name }}
        </div>
      </template>
      <template #append="{ item }">
        <v-btn
          v-if="checkIfAuthorizedWorkspaceMenu(item)"
          :disabled="!hasRightToCreateFolder(item)"
          icon
          @click="(event) => openNewFolderModal(event, item)"
        >
          <v-icon>add</v-icon>
        </v-btn>
        <v-menu v-if="checkIfAuthorizedFolderMenu(item)" offset-y>
          <template #activator="{ on }">
            <v-btn color="accent" dark icon v-on="on">
              <v-icon>mdi-dots-vertical</v-icon>
            </v-btn>
          </template>
          <v-list activable>
            <v-list-item nuxt @click="openRenameFolderModal(item)">
              <v-list-item-avatar>
                <v-btn color="accent" icon>
                  <v-icon>edit</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>{{ $t('folders.rename') }} </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="hasRightToCreateFolder(item)"
              nuxt
              @click="(event) => openNewFolderModal(event, item)"
            >
              <v-list-item-avatar>
                <v-btn color="accent" icon>
                  <v-icon>folder</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>
                {{ $t('global.newFolder') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item nuxt @click="displayMoveModal(item)">
              <v-list-item-avatar>
                <v-btn color="accent" icon>
                  <v-icon>drive_file_move</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>
                {{ $t('global.move') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item nuxt @click="displayDeleteModal(item)">
              <v-list-item-avatar>
                <v-btn color="accent" icon>
                  <v-icon>delete</v-icon>
                </v-btn>
              </v-list-item-avatar>
              <v-list-item-title>
                {{ $t('global.delete') }}
              </v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </template>
    </v-treeview>
    <folder-delete-modal
      ref="modalDeleteFolderDialog"
      @delete-folder="handleDeleteFolder"
    />
    <folder-rename-modal
      ref="modalRenameFolderDialog"
      :conflict-error="conflictError"
      :loading-parent="areLoadingWorkspaces"
      @rename-folder="handleRenameFolder"
    />
    <folder-move-modal ref="moveModal" @confirm="onMoveFolder">
      <p
        class="black--text"
        v-html="$t('folders.moveFolderConfirmationMessage')"
      />
    </folder-move-modal>

    <folder-new-modal
      ref="folderNewModalRef"
      :conflict-error="conflictError"
      @create-new-folder="createNewFolder"
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
  font-size: 0.875rem;
}
.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}
.v-list-item__title {
  font-size: 0.875rem;
}
</style>
