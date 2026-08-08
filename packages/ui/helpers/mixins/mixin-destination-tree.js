/**
 * Mixin for destination tree selection in modals (copy, move, translate)
 * Provides shared logic for:
 * - Computing which nodes should be expanded (current path only)
 * - Pre-selecting the current location
 * - Handling destination selection
 */
import { mapState } from 'vuex';
import { FOLDER, FETCH_FOLDER_CHILDREN } from '~/store/folder';
import { findNestedLocation } from '~/utils/workspaces';

export default {
  data() {
    return {
      selectedLocation: null,
      openNodes: [],
      activeNode: [],
    };
  },
  computed: {
    ...mapState(FOLDER, [
      'treeviewWorkspacesHasRight',
      'areLoadingWorkspaces',
      'folder',
      'workspace',
    ]),
    /**
     * Get the current location ID (folder or workspace)
     * Handles both .id and ._id formats
     */
    currentLocationId() {
      const folderId = this.folder?.id || this.folder?._id;
      const workspaceId = this.workspace?.id || this.workspace?._id;
      return folderId || workspaceId || null;
    },
  },
  watch: {
    /**
     * Watch treeviewWorkspacesHasRight to update openNodes when data is loaded
     */
    treeviewWorkspacesHasRight: {
      immediate: true,
      handler(newValue) {
        if (newValue?.length) {
          this.updateOpenNodes();
        }
      },
    },
    /**
     * Also watch folder/workspace changes
     */
    folder: {
      immediate: true,
      handler() {
        if (this.treeviewWorkspacesHasRight?.length) {
          this.updateOpenNodes();
        }
      },
    },
    workspace: {
      immediate: true,
      handler() {
        if (this.treeviewWorkspacesHasRight?.length) {
          this.updateOpenNodes();
        }
      },
    },
  },
  methods: {
    /**
     * Update which nodes should be expanded in the tree
     * Called when tree data or current location changes
     */
    updateOpenNodes() {
      const currentId = this.currentLocationId;
      if (!currentId || !this.treeviewWorkspacesHasRight?.length) {
        this.openNodes = [];
        return;
      }

      // Find the current location in the tree
      const currentItem = findNestedLocation(
        this.treeviewWorkspacesHasRight,
        'id',
        currentId
      );

      if (!currentItem?.path) {
        // Fallback: try to find by matching with _id format
        const currentItemAlt = this.findLocationById(
          this.treeviewWorkspacesHasRight,
          currentId
        );
        if (currentItemAlt?.path) {
          const pathIds = this.extractPathIds(currentItemAlt.path);
          this.openNodes = this.findNodesByIds(
            pathIds,
            this.treeviewWorkspacesHasRight
          );
          return;
        }
        this.openNodes = [];
        return;
      }

      // Extract all IDs from the path (root to current)
      const pathIds = this.extractPathIds(currentItem.path);
      // Convert IDs to node objects (required by v-treeview)
      this.openNodes = this.findNodesByIds(
        pathIds,
        this.treeviewWorkspacesHasRight
      );
    },
    /**
     * Recursively find nodes by their IDs in the tree
     * Returns node objects, not just IDs (required by v-treeview :open prop)
     * @param {Array<string>} ids - Array of IDs to find
     * @param {Array} items - Tree items to search in
     * @returns {Array} - Array of node objects
     */
    findNodesByIds(ids, items) {
      const result = [];
      if (!items?.length || !ids?.length) {
        return result;
      }

      const findInTree = (nodes) => {
        for (const node of nodes) {
          if (ids.includes(node.id)) {
            result.push(node);
          }
          if (node.children?.length) {
            findInTree(node.children);
          }
        }
      };

      findInTree(items);
      return result;
    },
    /**
     * Recursively find a location by ID, checking both id and _id
     */
    findLocationById(items, targetId) {
      if (!items?.length) return null;

      for (const item of items) {
        // Check both id formats
        if (item.id === targetId || item._id === targetId) {
          return item;
        }
        // Recurse into children
        if (item.children?.length) {
          const found = this.findLocationById(item.children, targetId);
          if (found) return found;
        }
      }
      return null;
    },
    /**
     * Extract all IDs from a nested path structure
     * @param {Object} path - Path object with nested pathChild
     * @returns {Array<string>} - Array of IDs from root to leaf
     */
    extractPathIds(path) {
      const ids = [];
      let current = path;

      while (current) {
        // Support both id formats
        const id = current.id || current._id;
        if (id) {
          ids.push(id);
        }
        current = current.pathChild;
      }

      return ids;
    },
    /**
     * Lazily fetch a node's direct children on expand.
     *
     * The destination tree reuses the sidebar's Vuex state
     * (`treeviewWorkspacesHasRight`), which is lazy-loaded: a folder with
     * `hasChildren` is given an empty `children: []` array so Vuetify renders
     * the expand arrow, but its real children are only fetched when expanded.
     * Without this handler, folders never expanded in the sidebar appear in the
     * modal but cannot be opened. We reuse the same store action as the sidebar;
     * it also persists the children onto the store node so they survive.
     *
     * Bind this to `:load-children` on the modal's v-treeview.
     * @param {Object} item - The tree node being expanded
     */
    async loadDestinationChildren(item) {
      // Vuetify keeps the lazy-load spinner up until this promise settles, so we
      // must always resolve even on error, otherwise it spins forever.
      try {
        const children = await this.$store.dispatch(
          `${FOLDER}/${FETCH_FOLDER_CHILDREN}`,
          { node: item }
        );
        item.children.splice(0, item.children.length, ...children);
      } catch (err) {
        console.error('[destinationTree] failed to load folder children:', err);
        item.children.splice(0, item.children.length);
      }
    },
    /**
     * Handle tree selection
     * @param {Array} selectedItems - Array of selected items from v-treeview
     */
    handleSelectDestination(selectedItems) {
      if (selectedItems[0]) {
        this.selectedLocation = selectedItems[0];
      }
    },
    /**
     * Reset selection when modal closes
     */
    resetDestination() {
      this.selectedLocation = null;
      this.openNodes = [];
      this.activeNode = [];
    },
    /**
     * Initialize tree state when modal opens
     * Call this in the modal's open() method
     */
    initDestinationTree() {
      this.selectedLocation = null;
      this.$nextTick(() => {
        this.updateOpenNodes();
        this.updateActiveNode();
      });
    },
    /**
     * Set the active (selected) node to the current location
     */
    updateActiveNode() {
      const currentId = this.currentLocationId;
      if (!currentId || !this.treeviewWorkspacesHasRight?.length) {
        this.activeNode = [];
        return;
      }

      // Find the current location node
      const currentNode = this.findLocationById(
        this.treeviewWorkspacesHasRight,
        currentId
      );

      this.activeNode = currentNode ? [currentNode] : [];
    },
  },
};
