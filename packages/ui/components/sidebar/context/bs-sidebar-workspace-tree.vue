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
  FETCH_FOLDER_CHILDREN,
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
  created() {
    // Non-reactive instance state: per-key timers to debounce the remote (DB)
    // persistence PUTs so rapid navigation doesn't spam the backend.
    this._remoteSaveTimers = {};
  },
  beforeDestroy() {
    Object.values(this._remoteSaveTimers || {}).forEach((t) => clearTimeout(t));
  },
  methods: {
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

        // With lazy-loading, treeviewWorkspaces only holds workspaces + their
        // first-level folders on a fresh load. The active node may be a deeper
        // sub-folder absent from the tree, which would make restoreSelectedNode
        // fail to find it (collapsing the tree to the first workspace). Load the
        // active folder's branch first so it (and its saved expansion) resolves.
        await this.loadActiveBranch();
        // Re-resolve saved open nodes now that the active branch is loaded.
        if (nodesToOpen.length === 0 && typeof localStorage !== 'undefined') {
          const saved = localStorage.getItem(this.storageKey);
          if (saved) {
            nodesToOpen = findNodesByIds(
              JSON.parse(saved),
              this.treeviewWorkspaces
            );
          }
        }

        this.treeKey++;

        this.$nextTick(() => {
          this.openNodes = nodesToOpen;
          // restoreSelectedNode handles both cases: if the URL already carries
          // a wid/fid it honours it (and returns early); on a bare /mailings it
          // restores the last saved selection from the cache, falling back to
          // the first workspace only when there's no valid saved node.
          this.restoreSelectedNode();
          // Reveal the branch of the active folder so it stays visible on
          // refresh / return from the editor, even if its ancestors weren't in
          // the saved expansion state.
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

      // The URL is the source of truth: when it already carries a valid
      // wid/fid (deep link, bookmark, refresh on a selection), honour it and
      // do NOT override it with a stale localStorage selection — that would
      // silently redirect a shared /mailings?fid=A link to the previous
      // session's folder B. The branch reveal is handled by ensureCurrentPathOpen.
      const { wid, fid } = this.$route.query;
      if (wid || fid) return;

      try {
        const savedSelection = localStorage.getItem(
          this.selectedNodeStorageKey
        );

        const parsedSavedCollection = savedSelection
          ? JSON.parse(savedSelection)
          : null;

        if (!parsedSavedCollection) {
          this.selectFirstWorkspace();
          return;
        }

        const { nodeId, nodeType } = parsedSavedCollection;

        if (nodeType === SPACE_TYPE.WORKSPACE) {
          // Workspaces are always present at the top level of the tree on a
          // fresh load. If the saved workspace isn't there, it was deleted:
          // drop the stale selection and fall back to the first workspace.
          const node = findNodeById(nodeId, this.treeviewWorkspaces);
          if (node) {
            this.safeNavigate('replace', { query: { wid: nodeId } });
          } else {
            this.clearSelection();
            this.selectFirstWorkspace();
          }
          return;
        }

        // Folder (possibly a level-2 sub-folder). With lazy-loading it may not
        // be in the in-memory tree yet, so a "not found" here does NOT mean
        // deleted — navigate to it regardless. onRouteChange then loads the
        // folder (getFolderAndWorkspaceData), reveals its branch
        // (loadActiveBranch + ensureCurrentPathOpen), and if it was actually
        // deleted the fetch fails harmlessly and the tree stays put. Crucially,
        // we must NOT clearSelection() here: that would wipe a valid sub-folder
        // selection just because it wasn't pre-loaded.
        this.safeNavigate('replace', { query: { fid: nodeId } });
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
      // Don't run while initializeTreeState is choosing the selection — both
      // would call selectFirstWorkspace and their navigations would cancel each
      // other ("Navigation cancelled with a new navigation"). Init owns the
      // cold-load selection; this only covers later route changes that land on
      // /mailings with nothing selected.
      if (this.isInitializing) return;

      // Source of truth is the route query, NOT currentLocation. When the user
      // lands on a bare /mailings (clicking "Email Builder" from another page,
      // or re-clicking the already-active menu), the router pushes /mailings
      // with no query. The tree component is never remounted (it lives in the
      // persistent layout and activeModule doesn't change), so
      // initializeTreeState's immediate watcher never re-fires, and
      // FETCH_FOLDER_OR_WORKSPACE is a no-op on an empty query so currentLocation
      // stays stale. Restore the last saved selection from the cache (falling
      // back to the first workspace) instead of jumping straight to the first
      // workspace and losing the user's last context.
      const { wid, fid } = this.$route.query;
      if (!wid && !fid && this.treeviewWorkspaces?.length > 0) {
        this.restoreSelectedNode();
      }
    },
    // Default selection: the first workspace. Used when arriving on the email
    // builder with nothing selected (menu, bare /mailings URL, or a saved
    // selection that no longer exists). Persists it and updates the route.
    selectFirstWorkspace() {
      const firstWorkspace = this.treeviewWorkspaces?.[0];
      if (!firstWorkspace) return;

      this.saveSelectedNode(firstWorkspace.id, firstWorkspace.type);
      if (this.$route.query.wid !== firstWorkspace.id) {
        this.safeNavigate('replace', { query: { wid: firstWorkspace.id } });
      }
    },
    // On every route change, load the active location then reveal its branch so
    // the selected folder stays visible without collapsing the rest of the tree.
    async onRouteChange() {
      await this.getFolderAndWorkspaceData();
      if (this.isInitializing) return;
      // The active folder may be a sub-folder whose parent's children aren't
      // loaded in the tree yet (e.g. just after creating a sub-folder, or
      // landing on a deep ?fid URL): load its branch first so findPathToNode
      // can resolve it, otherwise ensureCurrentPathOpen reveals nothing and the
      // sidebar stays collapsed on the new node.
      await this.loadActiveBranch();
      this.ensureCurrentPathOpen();
    },
    // Open the ancestors of the active folder (without dropping already-open
    // nodes) so it stays visible after a refresh / return from the editor.
    // findPathToNode resolves them from the in-memory tree: to be on a
    // sub-folder the user expanded its branch, whose expansion is restored
    // before this runs. Folders are capped at workspace > folder > sub-folder,
    // so there is no deeper, not-yet-loaded case.
    ensureCurrentPathOpen() {
      const currentId = this.currentLocation;
      if (!currentId || !this.treeviewWorkspaces?.length) return;

      const ancestors = findPathToNode(currentId, this.treeviewWorkspaces);
      if (!ancestors || ancestors.length === 0) return;

      const openIds = new Set(this.openNodes.map((node) => node.id));
      const missing = ancestors.filter((node) => !openIds.has(node.id));
      if (missing.length === 0) return;

      this.openNodes = [...this.openNodes, ...missing];
      this.saveTreeState(this.openNodes.map((node) => node.id));
    },
    // On a fresh load the active node may be a sub-folder that lazy-loading
    // hasn't put in the tree yet, so restoreSelectedNode/ensureCurrentPathOpen
    // can't find it. The active folder doc (store) carries its _parentFolder;
    // its parent is a first-level folder already present in the tree, so we
    // load that parent's children to make the sub-folder resolvable. Folders
    // are capped at workspace > folder > sub-folder, so one level suffices.
    async loadActiveBranch() {
      const parentId =
        this.folder?._parentFolder?.toString?.() || this.folder?._parentFolder;
      if (!parentId) return;

      const parentNode = findNodeById(parentId, this.treeviewWorkspaces);
      // Empty children array => has children, not loaded yet.
      if (
        parentNode &&
        Array.isArray(parentNode.children) &&
        parentNode.children.length === 0
      ) {
        try {
          await this.$store.dispatch(`${FOLDER}/${FETCH_FOLDER_CHILDREN}`, {
            node: parentNode,
          });
        } catch (err) {
          console.error(
            '[BsSidebarWorkspaceTree] Error loading active branch:',
            err
          );
        }
      }
    },
    // vue-router's push/replace rejects on benign navigation outcomes and,
    // depending on the build, may return undefined instead of a promise:
    // - NavigationDuplicated: targeting the already-current route
    // - NavigationCancelled: a newer navigation superseded this one
    // - NavigationAborted: a navigation guard stopped it (e.g. a concurrent
    //   replace landed first)
    // - NavigationRedirected: a guard redirected elsewhere
    // None are real errors here, so swallow them; rethrow anything else.
    safeNavigate(method, location) {
      const result = this.$router[method](location);
      if (!result || typeof result.catch !== 'function') {
        return Promise.resolve();
      }
      const benign = [
        'NavigationDuplicated',
        'NavigationCancelled',
        'NavigationAborted',
        'NavigationRedirected',
      ];
      return result.catch((err) => {
        if (benign.includes(err?.name)) {
          return;
        }
        throw err;
      });
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
        // Navigating to the new folder triggers onRouteChange, which refetches
        // the mailing list for it — no separate refresh event is needed (and
        // nothing listens for one).
        await this.safeNavigate('push', { query: { fid: folder?._id } });
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
    async fetchWorkspacesData() {
      await this.$store.dispatch(`${FOLDER}/${FETCH_WORKSPACES}`);
    },
    // Vuetify calls this the first time a node with an (empty) `children` array
    // is expanded. We fetch the direct children on demand. The store action also
    // persists them onto the matching node in `treeviewWorkspaces`, so they
    // survive a tree recreation (treeKey++); here we additionally fill Vuetify's
    // own `item.children` so they render immediately on this expand.
    async loadChildren(item) {
      // Vuetify keeps the node's lazy-load spinner up until this promise
      // settles. If the fetch rejects (e.g. a 404) we must still resolve here,
      // otherwise the loader spins forever. Fall back to an empty list.
      try {
        const children = await this.$store.dispatch(
          `${FOLDER}/${FETCH_FOLDER_CHILDREN}`,
          { node: item }
        );
        item.children.splice(0, item.children.length, ...children);
      } catch (err) {
        item.children.splice(0, item.children.length);
      }
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
        this.safeNavigate('push', { path: '/mailings', query });
        return;
      }

      // An empty selection ([]) is NEVER a user action here — it's a Vuetify
      // artifact. It fires when:
      //   - the user re-clicks the already-active node (activatable toggles it
      //     off), or
      //   - the tree is recreated (treeKey++ during init) and re-renders with
      //     :active=[selectedItem] while currentLocation is still undefined, so
      //     :active resolves to [{id: undefined}] → emits [].
      // In BOTH cases we must NOT navigate or touch the saved selection.
      // Previously this branch called selectFirstWorkspace(), which on a cold
      // load fired BEFORE restoreSelectedNode() and overwrote the cached
      // selection (e.g. a sub-folder) with the first workspace, then cancelled
      // the in-flight restore navigation. The default selection is owned solely
      // by initializeTreeState (restoreSelectedNode) and checkIfNotData.
      //
      // If there is a current location, re-assert it so the highlight sticks
      // (the :active binding alone won't, since currentLocation is unchanged).
      if (this.currentLocation) {
        this.$nextTick(() => {
          this.$refs.tree?.updateActive(this.currentLocation, true);
        });
      }
      // Otherwise: do nothing. Init / checkIfNotData will pick the selection.
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
          // Active folder (or its parent) was deleted: fall back to the first
          // workspace. selectFirstWorkspace persists the new selection and
          // navigates; :active follows selectedItem, so the workspace becomes
          // active on its own — no manual updateActive([]).
          this.clearSelection();
          this.selectFirstWorkspace();
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

        await this.safeNavigate('push', {
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
    // Debounced per key: rapid navigation fires several saves per click
    // (selection + branch expansion). Browser localStorage is already updated
    // synchronously by callers; here we only coalesce the remote (DB) PUT so we
    // don't spam the backend. Last value within the window wins.
    setRemoteLocalStorageKey(key, value) {
      if (this._remoteSaveTimers[key]) {
        clearTimeout(this._remoteSaveTimers[key]);
      }
      this._remoteSaveTimers[key] = setTimeout(() => {
        delete this._remoteSaveTimers[key];
        this.$axios
          .$put(setUserPersistedLocalStorageKey(key), { value })
          .catch((e) =>
            console.error(
              '[BsSidebarWorkspaceTree] Remote localStorage update failed:',
              e
            )
          );
      }, 600);
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
        :load-children="loadChildren"
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
