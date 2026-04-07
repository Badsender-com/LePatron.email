<script>
import {
  getFolder,
  deleteFolder,
  moveFolder,
  folders,
  getUserPersistedLocalStorageKey,
  setUserPersistedLocalStorageKey,
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
import { FolderOpen, Folder, Users, Plus, MoreVertical, TextCursor, FolderPlus, FolderInput, Trash2 } from 'lucide-vue';

const TREE_STATE_STORAGE_KEY = 'lepatron_workspace_tree_state';
const SELECTED_NODE_STORAGE_KEY = 'lepatron_selected_node';

export default {
  name: 'WorkspaceTree',
  components: {
    FolderRenameModal,
    FolderDeleteModal,
    FolderMoveModal,
    FolderNewModal,
    LucideFolderOpen: FolderOpen,
    LucideFolder: Folder,
    LucideUsers: Users,
    LucidePlus: Plus,
    LucideMoreVertical: MoreVertical,
    LucideTextCursor: TextCursor,
    LucideFolderPlus: FolderPlus,
    LucideFolderInput: FolderInput,
    LucideTrash2: Trash2,
  },
  mixins: [mixinCurrentLocation],
  data: () => ({
    selectedItemToDelete: {},
    conflictError: false,
    openNodes: [],
    isInitializing: false,
    treeKey: 0,
  }),
  async fetch() {
    const { dispatch } = this.$store;
    await dispatch(`${FOLDER}/${FETCH_FOLDER_OR_WORKSPACE}`, {
      query: this.$route.query,
      $t: this.$t || null,
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
    selectedNodeStorageKey() {
      // Create unique storage key per user for selected node
      const userId = this.userInfo?.id || 'anonymous';
      return `${SELECTED_NODE_STORAGE_KEY}_${userId}`;
    },
  },
  watch: {
    $route: ['getFolderAndWorkspaceData', 'checkIfNotData'],
    treeviewWorkspaces: {
      handler(newWorkspaces, oldWorkspaces) {
        // Initialize tree state only when workspaces data first loads
        // (transition from empty/undefined to populated)
        const isInitialLoad =
          newWorkspaces &&
          newWorkspaces.length > 0 &&
          (!oldWorkspaces || oldWorkspaces.length === 0);

        if (isInitialLoad) {
          this.initializeTreeState();
        }
      },
      immediate: true,
    },
  },
  methods: {
    /**
     * Find a single node by its ID in the tree
     */
    findNodeById(id, items) {
      if (!items || items.length === 0 || !id) {
        return null;
      }

      for (const node of items) {
        if (node.id === id) {
          return node;
        }
        if (node.children && node.children.length > 0) {
          const found = this.findNodeById(id, node.children);
          if (found) {
            return found;
          }
        }
      }

      return null;
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
        nodes.forEach((node) => {
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
     * Tree state restoration priority (per user):
     * 1) Browser localStorage (fast path) if present
     * 2) DB-persisted localStorage (hydration) if browser keys are missing
     * 3) Fallback: first workspace (and empty open nodes)
     *
     * Notes:
     * - hydrateBrowserFromDbIfEmpty() only fills missing browser keys; it never overwrites existing local values.
     * - Selected node restoration runs after open nodes are set to avoid Vuetify race conditions.
     */
    async initializeTreeState() {
      // Set flag to ignore @update:open events during initialization
      this.isInitializing = true;

      await this.hydrateBrowserFromDbIfEmpty();

      let nodesToOpen = [];

      try {
        if (typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(this.storageKey);

          if (saved) {
            // Restore saved IDs
            const savedIds = JSON.parse(saved);
            // Find the actual node objects from treeviewWorkspaces
            nodesToOpen = this.findNodesByIds(
              savedIds,
              this.treeviewWorkspaces
            );
          } else {
            // Default: everything closed
            nodesToOpen = [];
            // Save this default state as empty array
            this.saveTreeState([]);
          }
        } else {
          // No localStorage available, default to all closed
          nodesToOpen = [];
        }
      } catch (error) {
        console.error('[WorkspaceTree] Error initializing tree state:', error);
        // Fallback to all closed
        nodesToOpen = [];
      }

      // CRITICAL: Increment treeKey FIRST to force v-treeview recreation
      this.treeKey++;

      // THEN set openNodes in $nextTick when the new component is ready
      this.$nextTick(() => {
        this.openNodes = nodesToOpen;

        // Restore selected node after tree state is initialized
        this.restoreSelectedNode();

        // Reset flag after a delay to let Vuetify fully sync
        setTimeout(() => {
          this.isInitializing = false;
        }, 100);
      });
    },
    /**
     * Restores selected node from localStorage; if absent, selects the first workspace.
     */
    restoreSelectedNode() {
      if (typeof localStorage === 'undefined') return;

      try {
        const savedSelection = localStorage.getItem(
          this.selectedNodeStorageKey
        );

        if (!savedSelection) {
          if (this.treeviewWorkspaces?.length) {
            this.$router.replace({
              query: { wid: this.treeviewWorkspaces[0].id },
            });
          }
          return;
        }

        const parsedSavedCollection = JSON.parse(savedSelection);

        if (parsedSavedCollection === null) {
          if (this.treeviewWorkspaces?.length) {
            this.$router.replace({
              query: { wid: this.treeviewWorkspaces[0].id },
            });
          }
          return;
        }

        const { nodeId, nodeType } = parsedSavedCollection;
        const node = this.findNodeById(nodeId, this.treeviewWorkspaces);

        if (node) {
          const currentQuery = this.$route.query;
          const queryParam =
            nodeType === SPACE_TYPE.WORKSPACE
              ? { wid: nodeId }
              : { fid: nodeId };

          if (
            (queryParam.fid && queryParam.fid !== currentQuery.fid) ||
            (queryParam.wid && queryParam.wid !== currentQuery.wid)
          ) {
            this.$router.replace({ query: queryParam });
          }
        } else if (
          this.treeviewWorkspaces &&
          this.treeviewWorkspaces.length > 0
        ) {
          // Only clear selection if workspaces are loaded but node doesn't exist
          // Don't clear if workspaces aren't loaded yet (race condition)
          this.clearSelection();
        }
      } catch (error) {
        console.error('[WorkspaceTree] Error restoring selected node:', error);
      }
    },
    /**
     * Save the selected node to localStorage
     */
    saveSelectedNode(nodeId, nodeType) {
      try {
        if (typeof localStorage !== 'undefined') {
          const selection = { nodeId, nodeType };
          localStorage.setItem(
            this.selectedNodeStorageKey,
            JSON.stringify(selection)
          );
        }
      } catch (error) {
        console.error('[WorkspaceTree] Error saving selected node:', error);
      }
      this.setRemoteLocalStorageKey(this.selectedNodeStorageKey, {
        nodeId,
        nodeType,
      });
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
      this.setRemoteLocalStorageKey(this.storageKey, openIds);
    },
    /**
     * Handle tree expansion state changes
     */
    handleTreeUpdate(openNodes) {
      // Ignore events during initialization (Vuetify emits @update:open when we set :open programmatically)
      if (this.isInitializing) {
        return;
      }

      this.openNodes = openNodes;
      // Extract IDs from node objects before saving
      const openIds = openNodes.map((node) => node.id);
      this.saveTreeState(openIds);
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
        console.error('[WorkspaceTree] Error creating folder:', error);
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
          $t: this.$t || null,
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
      // Ignore selection events during initialization to prevent clearing localStorage
      // This prevents race condition where v-treeview emits empty selection before restoration
      if (this.isInitializing) {
        return;
      }

      const node = selectedItems[0] || null;

      if (node) {
        this.saveSelectedNode(node.id, node.type);
        const query =
          node.type === SPACE_TYPE.WORKSPACE
            ? { wid: node.id }
            : { fid: node.id };
        this.$router.push({ query });
      } else {
        this.clearSelection();
        this.$router.replace({ query: {} });
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

        const deletingCurrent =
          this.selectedItemToDelete.id === this.selectedItem.id;
        const deletingParentOfCurrent = this.selectedItemToDelete.children?.some(
          (child) => child.id === this.selectedItem.id
        );

        if (deletingCurrent || deletingParentOfCurrent) {
          this.clearSelection();
          await this.$router.replace({
            query: { wid: this.workspaces[0]?._id },
          });
          this.$nextTick(() => {
            this.$refs.tree.updateActive([]);
          });
        }
      } catch (error) {
        console.error('[WorkspaceTree] Error deleting folder:', error);
        this.showSnackbar({
          text: this.$t('global.errors.errorOccured'),
          color: 'error',
        });
      } finally {
        this.loading = false;
        await this.fetchWorkspacesData();
      }
    },
    clearSelection() {
      this.selectedItemToDelete = {};
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(this.selectedNodeStorageKey, JSON.stringify(null));
      }
      this.setRemoteLocalStorageKey(this.selectedNodeStorageKey, null);
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
        console.error('[WorkspaceTree] Error moving folder:', error);
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
    async getRemoteLocalStorageKey(key) {
      try {
        const res = await this.$axios.$get(
          getUserPersistedLocalStorageKey(key)
        );
        return res?.value ?? null;
      } catch (e) {
        return null;
      }
    },
    async setRemoteLocalStorageKey(key, value) {
      this.$axios
        .$put(setUserPersistedLocalStorageKey(key), { value })
        .catch((e) =>
          console.error('[WorkspaceTree] Remote localStorage update failed:', e)
        );
    },
    async hydrateBrowserFromDbIfEmpty() {
      if (typeof localStorage === 'undefined') return;

      const hasTree = !!localStorage.getItem(this.storageKey);
      const hasSel = !!localStorage.getItem(this.selectedNodeStorageKey);
      if (hasTree && hasSel) return; // already ok

      // 1) open nodes
      if (!hasTree) {
        const remoteTree = await this.getRemoteLocalStorageKey(this.storageKey);
        if (remoteTree) {
          localStorage.setItem(this.storageKey, JSON.stringify(remoteTree));
        }
      }

      // 2) selected node
      if (!hasSel) {
        const remoteSel = await this.getRemoteLocalStorageKey(
          this.selectedNodeStorageKey
        );
        if (remoteSel) {
          localStorage.setItem(
            this.selectedNodeStorageKey,
            JSON.stringify(remoteSel)
          );
        }
      }
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
      :key="treeKey"
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
      <template #prepend="{ item, active }">
        <!-- Workspace icon -->
        <lucide-users
          v-if="item.type === 'workspace'"
          :size="18"
          :class="['tree-icon', {
            'tree-icon--active': active,
            'tree-icon--disabled': !item.hasAccess
          }]"
        />
        <!-- Folder icons -->
        <template v-else>
          <lucide-folder-open
            v-if="active"
            :size="18"
            :class="['tree-icon', 'tree-icon--active', {
              'tree-icon--disabled': !item.hasAccess
            }]"
          />
          <lucide-folder
            v-else
            :size="18"
            :class="['tree-icon', {
              'tree-icon--disabled': !item.hasAccess
            }]"
          />
        </template>
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
          <lucide-plus :size="18" />
        </v-btn>
        <v-menu v-if="checkIfAuthorizedFolderMenu(item)" offset-y left>
          <template #activator="{ on }">
            <v-btn
              icon
              small
              class="folder-menu-btn"
              v-on="on"
            >
              <lucide-more-vertical :size="18" />
            </v-btn>
          </template>
          <v-list class="folder-context-menu" dense>
            <v-list-item class="folder-menu-item" @click="openRenameFolderModal(item)">
              <v-list-item-icon class="folder-menu-item__icon">
                <lucide-text-cursor :size="18" />
              </v-list-item-icon>
              <v-list-item-title class="folder-menu-item__title">
                {{ $t('folders.rename') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item
              v-if="hasRightToCreateFolder(item)"
              class="folder-menu-item"
              @click="(event) => openNewFolderModal(event, item)"
            >
              <v-list-item-icon class="folder-menu-item__icon">
                <lucide-folder-plus :size="18" />
              </v-list-item-icon>
              <v-list-item-title class="folder-menu-item__title">
                {{ $t('global.newFolder') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item class="folder-menu-item" @click="displayMoveModal(item)">
              <v-list-item-icon class="folder-menu-item__icon">
                <lucide-folder-input :size="18" />
              </v-list-item-icon>
              <v-list-item-title class="folder-menu-item__title">
                {{ $t('global.move') }}
              </v-list-item-title>
            </v-list-item>
            <v-list-item class="folder-menu-item" @click="displayDeleteModal(item)">
              <v-list-item-icon class="folder-menu-item__icon">
                <lucide-trash2 :size="18" />
              </v-list-item-icon>
              <v-list-item-title class="folder-menu-item__title">
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

<style lang="scss" scoped>
/* Tree icon color states */
.tree-icon {
  color: rgba(0, 0, 0, 0.54);
  transition: color 0.15s ease;

  &--active {
    color: var(--v-accent-base);
  }

  &--disabled {
    color: rgba(0, 0, 0, 0.26);
  }
}

.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

.v-treeview {
  overflow-y: auto;
  font-size: 0.875rem;

  ::v-deep {
    .v-treeview-node__root {
      padding-left: 8px;
      min-height: 40px;
      border-radius: 4px;
      margin: 2px 4px;
      transition: background-color 0.15s ease;

      &:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
    }

    .v-treeview-node--active > .v-treeview-node__root {
      background-color: rgba(0, 172, 220, 0.1);

      &:hover {
        background-color: rgba(0, 172, 220, 0.15);
      }
    }

    .v-treeview-node__content {
      margin-left: 4px;
    }

    .v-treeview-node__label {
      font-weight: 500;
      color: rgba(0, 0, 0, 0.8);
    }

    .v-treeview-node--active .v-treeview-node__label {
      color: var(--v-accent-base);
      font-weight: 600;
    }

    .v-treeview-node__toggle {
      color: rgba(0, 0, 0, 0.4);
    }
  }
}

.v-treeview-node__label > div {
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
}

/* Folder menu button */
.folder-menu-btn {
  color: rgba(0, 0, 0, 0.54);
  transition: color 0.15s ease, background-color 0.15s ease;

  &:hover {
    color: var(--v-primary-base);
    background-color: rgba(0, 0, 0, 0.04);
  }
}

/* Folder context menu */
.folder-context-menu {
  padding: 8px 0;
  min-width: 180px;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

.folder-menu-item {
  min-height: 40px;
  padding: 0 16px;
  cursor: pointer;

  &:hover {
    background-color: rgba(0, 0, 0, 0.04);
  }

  &__icon {
    margin-right: 12px;
    min-width: 24px;
    justify-content: center;
    color: rgba(0, 0, 0, 0.54);
  }

  &__title {
    font-size: 0.875rem;
    color: rgba(0, 0, 0, 0.87);
  }
}
</style>
