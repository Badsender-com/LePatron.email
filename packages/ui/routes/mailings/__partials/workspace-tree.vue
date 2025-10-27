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
    isInitializing: false,
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
      handler(newWorkspaces, oldWorkspaces) {
        console.log('[WorkspaceTree] treeviewWorkspaces changed:', {
          newCount: newWorkspaces?.length || 0,
          oldCount: oldWorkspaces?.length || 0,
          currentOpenCount: this.openNodes?.length || 0,
        });
        // Initialize tree state only when workspaces data first loads
        // (transition from empty/undefined to populated)
        const isInitialLoad = newWorkspaces && newWorkspaces.length > 0 &&
                              (!oldWorkspaces || oldWorkspaces.length === 0);

        if (isInitialLoad) {
          console.log('[WorkspaceTree] Initial load detected, initializing tree state...');
          this.initializeTreeState();
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
     * Get all workspace IDs (for default open state)
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
     * Recursively find nodes by their IDs in the tree
     */
    findNodesByIds(ids, items) {
      const result = [];
      if (!items || items.length === 0 || !ids || ids.length === 0) {
        return result;
      }

      const findInTree = (nodes) => {
        nodes.forEach(node => {
          if (ids.includes(node.id)) {
            result.push(node);
          }
          if (node.children && node.children.length > 0) {
            findInTree(node.children);
          }
        });
      };

      findInTree(items);
      return result;
    },
    /**
     * Initialize tree state - load saved state or default to all closed
     */
    initializeTreeState() {
      console.log('[WorkspaceTree] initializeTreeState called');
      console.log('[WorkspaceTree] storageKey:', this.storageKey);

      // Set flag to ignore @update:open events during initialization
      this.isInitializing = true;

      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(this.storageKey);
          console.log('[WorkspaceTree] Saved state from localStorage:', saved);

          if (saved) {
            // Restore saved IDs
            const savedIds = JSON.parse(saved);
            console.log('[WorkspaceTree] Parsed saved IDs:', savedIds);

            // Find the actual node objects from treeviewWorkspaces
            const foundNodes = this.findNodesByIds(savedIds, this.treeviewWorkspaces);
            console.log('[WorkspaceTree] Found nodes:', foundNodes.length, 'nodes');

            this.openNodes = foundNodes;
            console.log('[WorkspaceTree] Set openNodes to restored nodes');
          } else {
            console.log('[WorkspaceTree] No saved state, using default (all closed)');
            // Default: everything closed
            this.openNodes = [];
            // Save this default state as empty array
            this.saveTreeState([]);
          }
        } else {
          console.log('[WorkspaceTree] localStorage not available');
          // No localStorage available, default to all closed
          this.openNodes = [];
        }
      } catch (error) {
        console.error('[WorkspaceTree] Error initializing tree state:', error);
        // Fallback to all closed
        this.openNodes = [];
      }

      console.log('[WorkspaceTree] Final openNodes:', this.openNodes.map(n => ({ id: n.id, name: n.name })));

      // Reset flag after a delay to let Vuetify fully sync
      // $nextTick is too fast - Vuetify emits events before it completes
      setTimeout(() => {
        this.isInitializing = false;
        console.log('[WorkspaceTree] Initialization complete, now listening to user interactions');
      }, 100);
    },
    /**
     * Save tree expansion state to localStorage (as IDs only)
     */
    saveTreeState(openIds) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(this.storageKey, JSON.stringify(openIds));
        }
      } catch (error) {
        console.error('Error saving tree state:', error);
      }
    },
    /**
     * Handle tree expansion state changes
     */
    handleTreeUpdate(openNodes) {
      console.log('[WorkspaceTree] handleTreeUpdate called with', openNodes.length, 'nodes');

      // Ignore events during initialization (Vuetify emits @update:open when we set :open programmatically)
      if (this.isInitializing) {
        console.log('[WorkspaceTree] Ignoring update during initialization');
        return;
      }

      this.openNodes = openNodes;
      // Extract IDs from node objects before saving
      const openIds = openNodes.map(node => node.id);
      console.log('[WorkspaceTree] Extracted IDs:', openIds);
      this.saveTreeState(openIds);
      console.log('[WorkspaceTree] State saved to localStorage');
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
