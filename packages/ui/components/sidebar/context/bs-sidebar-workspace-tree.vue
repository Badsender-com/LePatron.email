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
import { findNodeById, findNodesByIds, findPathToNode } from '~/utils/tree';
import mixinCurrentLocation from '~/helpers/mixins/mixin-current-location';
import FolderRenameModal from '~/routes/mailings/__partials/folder-rename-modal';
import FolderMoveModal from '~/routes/mailings/__partials/folder-move-modal';
import FolderNewModal from '~/routes/mailings/__partials/folder-new-modal';
import FolderDeleteModal from '~/routes/mailings/__partials/folder-delete-modal';
import { SPACE_TYPE } from '~/helpers/constants/space-type';
import {
  FolderOpen,
  Folder,
  Users,
  Plus,
  TextCursor,
  FolderPlus,
  FolderInput,
  Trash2,
} from 'lucide-vue';
import BsRowActions from '~/components/row-actions/bs-row-actions.vue';

const TREE_STATE_STORAGE_KEY = 'lepatron_workspace_tree_state';
const SELECTED_NODE_STORAGE_KEY = 'lepatron_selected_node';

export default {
  name: 'BsSidebarWorkspaceTree',
  components: {
    FolderRenameModal,
    FolderDeleteModal,
    FolderMoveModal,
    FolderNewModal,
    BsRowActions,
    LucideFolderOpen: FolderOpen,
    LucideFolder: Folder,
    LucideUsers: Users,
    LucidePlus: Plus,
  },
  mixins: [mixinCurrentLocation],
  props: {
    collapsed: {
      type: Boolean,
      default: false,
    },
  },
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
      const userId = this.userInfo?.id || 'anonymous';
      return `${TREE_STATE_STORAGE_KEY}_${userId}`;
    },
    selectedNodeStorageKey() {
      const userId = this.userInfo?.id || 'anonymous';
      return `${SELECTED_NODE_STORAGE_KEY}_${userId}`;
    },
  },
  watch: {
    $route: ['onRouteChange', 'checkIfNotData'],
    treeviewWorkspaces: {
      handler(newWorkspaces, oldWorkspaces) {
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
    // Merge the ancestor branch of the currently selected node into openNodes
    // without dropping any already-open node. Keeps the active folder visible
    // and persists the expansion so a later refresh keeps it open too.
    // (findNodeById / findNodesByIds / findPathToNode live in ~/utils/tree.js)
    ensureCurrentPathOpen() {
      const currentId = this.currentLocation;
      if (!currentId || !this.treeviewWorkspaces?.length) return;

      const pathNodes = findPathToNode(currentId, this.treeviewWorkspaces);
      if (!pathNodes || pathNodes.length === 0) return;

      const openIds = new Set(this.openNodes.map((node) => node.id));
      const missing = pathNodes.filter((node) => !openIds.has(node.id));
      if (missing.length === 0) return;

      this.openNodes = [...this.openNodes, ...missing];
      this.saveTreeState(this.openNodes.map((node) => node.id));
    },
    async initializeTreeState() {
      // Guard against concurrent initialization (race condition fix)
      if (this.isInitializing) {
        return;
      }

      this.isInitializing = true;

      try {
        await this.hydrateBrowserFromDbIfEmpty();

        let nodesToOpen = [];

        try {
          if (typeof localStorage !== 'undefined') {
            const saved = localStorage.getItem(this.storageKey);

            if (saved) {
              const savedIds = JSON.parse(saved);
              nodesToOpen = findNodesByIds(savedIds, this.treeviewWorkspaces);
            } else {
              nodesToOpen = [];
              this.saveTreeState([]);
            }
          } else {
            nodesToOpen = [];
          }
        } catch (error) {
          console.error(
            '[BsSidebarWorkspaceTree] Error initializing tree state:',
            error
          );
          nodesToOpen = [];
        }

        this.treeKey++;

        this.$nextTick(() => {
          this.openNodes = nodesToOpen;
          this.restoreSelectedNode();
          // Always reveal the branch of the active folder, even if it wasn't
          // part of the saved expansion state (fixes: tree collapsing on
          // refresh / not revealing the folder when returning from a mail).
          this.ensureCurrentPathOpen();

          // Wait one more tick so the v-treeview has finished applying
          // openNodes + activeNode reactively before we drop the
          // isInitializing guard. Previously a setTimeout(100) was used as
          // a "good enough" sleep; chaining $nextTick is the correct
          // Vue-aware version of the same intent.
          this.$nextTick(() => {
            this.isInitializing = false;
          });
        });
      } catch (error) {
        console.error(
          '[BsSidebarWorkspaceTree] Fatal error during initialization:',
          error
        );
        this.isInitializing = false;
      }
    },
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
        const node = findNodeById(nodeId, this.treeviewWorkspaces);

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
          this.clearSelection();
        }
      } catch (error) {
        console.error(
          '[BsSidebarWorkspaceTree] Error restoring selected node:',
          error
        );
      }
    },
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
        console.error(
          '[BsSidebarWorkspaceTree] Error saving selected node:',
          error
        );
      }
      this.setRemoteLocalStorageKey(this.selectedNodeStorageKey, {
        nodeId,
        nodeType,
      });
    },
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
    handleTreeUpdate(openNodes) {
      if (this.isInitializing) {
        return;
      }

      this.openNodes = openNodes;
      const openIds = openNodes.map((node) => node.id);
      this.saveTreeState(openIds);
    },
    async checkIfNotData() {
      if (!this.selectedItem?.id && this.treeviewWorkspaces?.length > 0) {
        await this.$router.push({
          query: { wid: this.treeviewWorkspaces[0]?.id },
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
        console.error('[BsSidebarWorkspaceTree] Error creating folder:', error);
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
    // On every route change (navigation, refresh, return from the editor via
    // ?fid=/?wid=), load the active location then reveal its branch so the
    // selected folder is always visible without collapsing the rest of the tree.
    async onRouteChange() {
      await this.getFolderAndWorkspaceData();
      if (this.isInitializing) return;
      this.ensureCurrentPathOpen();
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
        this.$router.push({ path: '/mailings', query });
      } else {
        this.clearSelection();
        this.$router.replace({ path: '/mailings', query: {} });
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
            path: '/mailings',
            query: { wid: this.treeviewWorkspaces[0]?.id },
          });
          this.$nextTick(() => {
            this.$refs.tree.updateActive([]);
          });
        }
      } catch (error) {
        console.error('[BsSidebarWorkspaceTree] Error deleting folder:', error);
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
          path: '/mailings',
          query: routerRedirectionParam,
        });
        this.showSnackbar({
          text: this.$t('folders.moveFolderSuccessful'),
          color: 'success',
        });
        await this.fetchWorkspacesData();
      } catch (error) {
        let errorKey = 'global.errors.errorOccured';
        if (error.response?.status === 409) {
          errorKey = 'folders.conflict';
        } else if (error.response?.status === 406) {
          errorKey = 'folders.hasChildren';
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
          console.error(
            '[BsSidebarWorkspaceTree] Remote localStorage update failed:',
            e
          )
        );
    },
    async hydrateBrowserFromDbIfEmpty() {
      if (typeof localStorage === 'undefined') return;

      const hasTree = !!localStorage.getItem(this.storageKey);
      const hasSel = !!localStorage.getItem(this.selectedNodeStorageKey);
      if (hasTree && hasSel) return;

      // Both fetches are independent, so parallelize. Doing them serially
      // added one round-trip of latency on every cold sidebar open.
      const [remoteTree, remoteSel] = await Promise.all([
        hasTree ? null : this.getRemoteLocalStorageKey(this.storageKey),
        hasSel
          ? null
          : this.getRemoteLocalStorageKey(this.selectedNodeStorageKey),
      ]);

      if (!hasTree && remoteTree) {
        localStorage.setItem(this.storageKey, JSON.stringify(remoteTree));
      }
      if (!hasSel && remoteSel) {
        localStorage.setItem(
          this.selectedNodeStorageKey,
          JSON.stringify(remoteSel)
        );
      }
    },
    buildFolderMenuActions(item) {
      const actions = [];

      actions.push({
        key: 'rename',
        icon: TextCursor,
        text: 'folders.rename',
        onClick: () => this.openRenameFolderModal(item),
      });

      if (this.hasRightToCreateFolder(item)) {
        actions.push({
          key: 'new-folder',
          icon: FolderPlus,
          text: 'global.newFolder',
          onClick: (event) => this.openNewFolderModal(event, item),
        });
      }

      actions.push({
        key: 'move',
        icon: FolderInput,
        text: 'global.move',
        onClick: () => this.displayMoveModal(item),
      });

      actions.push({
        key: 'delete',
        icon: Trash2,
        text: 'global.delete',
        variant: 'danger',
        onClick: () => this.displayDeleteModal(item),
      });

      return actions;
    },
  },
};
</script>

<template>
  <div v-if="!collapsed" class="bs-sidebar-workspace-tree">
    <!-- Section header -->
    <div class="workspace-tree-header">
      <span class="workspace-tree-header__label">WORKSPACES</span>
    </div>

    <!-- Tree -->
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
        dense
        @update:active="handleSelectItemFromTreeView"
        @update:open="handleTreeUpdate"
      >
        <template #prepend="{ item, active }">
          <lucide-users
            v-if="item.type === 'workspace'"
            :size="16"
            :class="[
              'tree-icon',
              {
                'tree-icon--active': active,
                'tree-icon--disabled': !item.hasAccess,
              },
            ]"
          />
          <template v-else>
            <lucide-folder-open
              v-if="active"
              :size="16"
              :class="[
                'tree-icon',
                'tree-icon--active',
                {
                  'tree-icon--disabled': !item.hasAccess,
                },
              ]"
            />
            <lucide-folder
              v-else
              :size="16"
              :class="[
                'tree-icon',
                {
                  'tree-icon--disabled': !item.hasAccess,
                },
              ]"
            />
          </template>
        </template>
        <template #label="{ item, active }">
          <div
            :class="['tree-label', { 'tree-label--disabled': !item.hasAccess }]"
            @click="active ? $event.stopPropagation() : null"
          >
            {{ item.name }}
          </div>
        </template>
        <template #append="{ item }">
          <v-btn
            v-if="checkIfAuthorizedWorkspaceMenu(item)"
            :disabled="!hasRightToCreateFolder(item)"
            icon
            x-small
            @click="(event) => openNewFolderModal(event, item)"
          >
            <lucide-plus :size="14" />
          </v-btn>
          <bs-row-actions
            v-if="checkIfAuthorizedFolderMenu(item)"
            :menu-actions="buildFolderMenuActions(item)"
          />
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
  </div>
</template>

<style lang="scss" scoped>
.bs-sidebar-workspace-tree {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.workspace-tree-header {
  padding: 12px 16px 8px;
  border-bottom: 1px solid #e0e0e0;
  flex-shrink: 0;

  &__label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.5px;
    color: rgba(0, 0, 0, 0.6);
    text-transform: uppercase;
  }
}

.tree-icon {
  color: rgba(0, 0, 0, 0.54);
  transition: color 0.15s ease;
  vertical-align: middle;

  &--active {
    color: var(--v-accent-base);
  }

  &--disabled {
    color: rgba(0, 0, 0, 0.26);
  }
}

/* Workspace / folder label: muted contrast when the user doesn't have
   access to it — keeps the entry visible (so the user knows it exists)
   without making it look interactive. */
.tree-label {
  color: rgba(0, 0, 0, 0.87);

  &--disabled {
    color: rgba(0, 0, 0, 0.5);
  }
}

.v-treeview-node--active,
.v-treeview--hoverable {
  cursor: pointer;
}

.v-skeleton-loader {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
}

.v-treeview {
  font-size: 13px;
  padding: 4px 8px;

  ::v-deep {
    .v-treeview-node__root {
      padding-left: 4px;
      min-height: 32px;
      border-radius: 4px;
      margin: 1px 0;
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
      font-weight: 400;
      font-size: 13px;
      color: rgba(0, 0, 0, 0.87);
    }

    .v-treeview-node--active .v-treeview-node__label {
      color: var(--v-accent-base);
      font-weight: 500;
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
</style>
