import {
  mailings,
  mailingsTags,
  getWorkspace,
  getFolder,
  getFolderAccess,
  getFolderChildren,
  getWorkspaceAccess,
  workspacesByGroup,
} from '~/helpers/api-routes';
import { parsePaginationData } from '~/utils/parsePagination';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';
import { getTreeviewWorkspaces } from '~/utils/workspaces';
import { mapChildFolderToTreeviewNode } from '~/utils/folders';

export const FOLDER = 'folder';
export const SET_FOLDER = 'SET_FOLDER';
export const SET_WORKSPACE = 'SET_WORKSPACE';
export const SET_HAS_ACCESS = 'SET_HAS_ACCESS';
export const SET_MAILINGS = 'SET_MAILINGS';
export const SET_TAGS = 'SET_TAGS';
export const SET_PAGINATION = 'SET_PAGINATION';
export const SET_FILTERS = 'SET_FILTERS';
export const SET_SORTBY = 'SET_SORTBY';
export const SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE =
  'SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE';

export const SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE =
  'SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE';

export const SET_WORKSPACES = 'SET_WORKSPACES';
export const SET_WORKSPACES_HAS_RIGHT = 'SET_WORKSPACES_HAS_RIGHT';
export const SET_TREEVIEW_WORKSPACES = 'SET_TREEVIEW_WORKSPACES';
export const SET_TREEVIEW_WORKSPACES_HASRIGHT =
  'SET_TREEVIEW_WORKSPACES_HASRIGHT';
export const SET_NODE_CHILDREN = 'SET_NODE_CHILDREN';
export const SET_ARE_LOADING_WORKSPACES = 'SET_ARE_LOADING_WORKSPACES';

export const IS_LOADING_WORKSPACE_OR_FOLDER = 'IS_LOADING_WORKSPACE_OR_FOLDER';

export const FETCH_WORKSPACES = 'FETCH_WORKSPACES';
export const FETCH_MAILINGS = 'fetchMailings';
export const FETCH_MAILINGS_TAGS = 'fetchMailingsTags';
export const FETCH_MAILINGS_FOR_FILTER_UPDATE = 'fetchMailingsForFilterUpdate';
export const FETCH_MAILINGS_FOR_WORKSPACE_UPDATE =
  'fetchMailingsForWorkspaceUpdate';
export const FETCH_FOLDER_OR_WORKSPACE = 'fetchFolderOrWorkspace';
export const FETCH_FOLDER_CHILDREN = 'fetchFolderChildren';

export const state = () => ({
  workspace: {},
  folder: {},
  hasAccess: false,
  pagination: {
    sortBy: ['updatedAt'],
    sortDesc: [true],
    page: 1,
    itemsPerPage: 25,
    pageStart: 0,
    pageStop: 25,
    pageCount: 1,
    itemsLength: 25,
  },
  filters: {
    name: '',
    templates: [],
    createdAtStart: '',
    createdAtEnd: '',
    updatedAtStart: '',
    updatedAtEnd: '',
    tags: [],
  },
  mailings: [],
  tags: [],
  isLoadingMailingsForFilterUpdate: false,
  isLoadingMailingsForWorkspaceUpdate: false,
  isLoadingWorkspaceOrFolder: false,
  areLoadingWorkspaces: [],
  workspaces: [],
  workspacesHasRight: [],
  treeviewWorkspaces: [],
  treeviewWorkspacesHasRight: [],
});

export const getters = {};

// https://medium.com/vuetify/creating-reusable-snackbars-with-vuetify-and-vuex-a8c3fef7b206
export const mutations = {
  [SET_FOLDER](store, folder) {
    store.folder = folder;
  },
  [SET_WORKSPACES](store, workspaces) {
    store.workspaces = workspaces;
  },
  [SET_WORKSPACES_HAS_RIGHT](store, workspacesHasRight) {
    store.workspacesHasRight = workspacesHasRight;
  },
  [SET_TREEVIEW_WORKSPACES](store, treeviewWorkspaces) {
    store.treeviewWorkspaces = treeviewWorkspaces;
  },
  [SET_TREEVIEW_WORKSPACES_HASRIGHT](store, treeviewWorkspacesHasRight) {
    store.treeviewWorkspacesHasRight = treeviewWorkspacesHasRight;
  },
  // Persists lazy-loaded children onto the matching node IN THE STORE (both tree
  // arrays), not just on Vuetify's internal node. This survives a v-treeview
  // recreation (`treeKey++`), which rebuilds the tree from `treeviewWorkspaces`
  // and would otherwise drop children pushed only into Vuetify's copy.
  [SET_NODE_CHILDREN](store, { nodeId, children }) {
    const applyToTree = (nodes) => {
      if (!Array.isArray(nodes)) return false;
      for (const node of nodes) {
        if (node.id === nodeId) {
          node.children = children;
          return true;
        }
        if (node.children && applyToTree(node.children)) {
          return true;
        }
      }
      return false;
    };
    applyToTree(store.treeviewWorkspaces);
    applyToTree(store.treeviewWorkspacesHasRight);
  },
  [IS_LOADING_WORKSPACE_OR_FOLDER](store, isLoadingWorkspaceOrFolder) {
    store.isLoadingWorkspaceOrFolder = isLoadingWorkspaceOrFolder;
  },
  [SET_ARE_LOADING_WORKSPACES](store, areLoadingWorkspaces) {
    store.areLoadingWorkspaces = areLoadingWorkspaces;
  },
  [SET_WORKSPACE](store, workspace) {
    store.workspace = workspace;
  },
  [SET_MAILINGS](store, mailings) {
    store.mailings = mailings;
  },
  [SET_TAGS](store, tags) {
    store.tags = tags;
  },
  [SET_PAGINATION](store, paginationData) {
    store.pagination = {
      ...store.pagination,
      ...paginationData,
    };
  },
  [SET_FILTERS](store, filters) {
    store.filters = {
      ...store.filters,
      ...filters,
    };
  },
  [SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE](
    store,
    isLoadingMailingsForFilterUpdate
  ) {
    store.isLoadingMailingsForFilterUpdate = isLoadingMailingsForFilterUpdate;
  },
  [SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE](
    store,
    isLoadingMailingsForWorkspaceUpdate
  ) {
    store.isLoadingMailingsForWorkspaceUpdate = isLoadingMailingsForWorkspaceUpdate;
  },
  [SET_HAS_ACCESS](store, hasAccess) {
    store.hasAccess = hasAccess;
  },
};

export const actions = {
  async [FETCH_FOLDER_OR_WORKSPACE]({ commit, dispatch }, { query, $t }) {
    commit(IS_LOADING_WORKSPACE_OR_FOLDER, true);
    try {
      if (!this.$axios || !query) {
        return;
      }

      if (query?.wid || query?.fid) {
        if (query?.fid) {
          const [folder, hasAccessData] = await Promise.all([
            this.$axios.$get(getFolder(query?.fid)),
            this.$axios.$get(getFolderAccess(query?.fid)),
          ]);
          commit(SET_FOLDER, folder);
          commit(SET_WORKSPACE, null);
          commit(SET_HAS_ACCESS, hasAccessData?.hasAccess);
        } else if (query?.wid) {
          const [workspace, hasAccessData] = await Promise.all([
            this.$axios.$get(getWorkspace(query?.wid)),
            this.$axios.$get(getWorkspaceAccess(query?.wid)),
          ]);
          commit(SET_FOLDER, null);
          commit(SET_WORKSPACE, workspace);
          commit(SET_HAS_ACCESS, hasAccessData?.hasAccess);
        }

        await dispatch(FETCH_MAILINGS_FOR_WORKSPACE_UPDATE, {
          query,
          $t,
        });
      }
    } catch {
      if ($t) {
        commit(
          `${PAGE}/${SHOW_SNACKBAR}`,
          {
            text: $t('global.errors.errorOccured'),
            color: 'error',
          },
          { root: true }
        );
      }
    } finally {
      commit(IS_LOADING_WORKSPACE_OR_FOLDER, false);
    }
  },
  async [FETCH_MAILINGS](
    { commit, dispatch, rootState },
    { query, $t, pagination }
  ) {
    if (!!query?.wid || !!query?.fid) {
      const queryMailing = rootState.folder.folder?.id
        ? { parentFolderId: query?.fid }
        : { workspaceId: query?.wid };
      // Fetch the filter tags in parallel and don't await it: tags are served
      // by a separate endpoint and must never delay the mailing list render.
      dispatch(FETCH_MAILINGS_TAGS, { queryMailing });
      try {
        const mailingsResponse = await this.$axios.$get(mailings(), {
          params: {
            ...queryMailing,
            // The backend does JSON.parse(pagination)/JSON.parse(filters)
            // (mailing.controller.js list()), so these must be sent as JSON
            // strings. Sending raw objects makes axios serialize them as
            // bracketed query params (pagination[sortBy][0]=...), which the
            // backend can't parse — the sort/filters were silently dropped.
            pagination: JSON.stringify({
              ...rootState.folder?.pagination,
              ...(pagination || {}),
            }),
            filters: JSON.stringify(rootState.folder?.filters || {}),
          },
        });
        const { docs, ...paginationsData } = mailingsResponse?.items;

        commit(SET_MAILINGS, docs);
        const {
          page,
          itemsPerPage,
          pageStart,
          pageStop,
          pageCount,
          itemsLength,
        } = parsePaginationData(paginationsData);
        commit(SET_PAGINATION, {
          page,
          itemsPerPage,
          pageStart,
          pageStop,
          pageCount,
          itemsLength,
        });
      } catch (e) {
        if ($t) {
          commit(
            `${PAGE}/${SHOW_SNACKBAR}`,
            {
              text: $t('global.errors.errorOccured'),
              color: 'error',
            },
            { root: true }
          );
        }
      }
    }
  },
  async [FETCH_MAILINGS_TAGS]({ commit }, { queryMailing }) {
    try {
      const { tags } = await this.$axios.$get(mailingsTags(), {
        params: queryMailing,
      });
      commit(SET_TAGS, tags || []);
    } catch (e) {
      // Tags only feed the filter dropdown: fail silently so a tags error
      // never breaks the mailing list itself.
      commit(SET_TAGS, []);
    }
  },
  async [FETCH_MAILINGS_FOR_FILTER_UPDATE](
    { commit, dispatch },
    { query, $t, pagination }
  ) {
    commit(SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE, true);
    await dispatch(FETCH_MAILINGS, { query, $t, pagination });
    commit(SET_IS_LOADING_MAILINGS_FOR_FILTER_UPDATE, false);
  },
  async [FETCH_MAILINGS_FOR_WORKSPACE_UPDATE](
    { commit, dispatch },
    { query, $t, pagination }
  ) {
    commit(SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE, true);
    await dispatch(FETCH_MAILINGS, { query, $t, pagination });
    commit(SET_IS_LOADING_MAILINGS_FOR_WORKSPACE_UPDATE, false);
  },
  // Lazy-loads the direct children of a tree node on expand. Returns the
  // children mapped to the treeview shape; the caller (v-treeview load-children)
  // is responsible for inserting them into the node's `children` array.
  async [FETCH_FOLDER_CHILDREN]({ commit }, { node }) {
    if (!this.$axios || !node?.id) {
      return [];
    }
    const { items } = await this.$axios.$get(getFolderChildren(node.id));
    const children = (items || []).map((child) =>
      mapChildFolderToTreeviewNode(child, node.hasAccess, node.path)
    );
    // Persist on the store node too, so the children survive a tree recreation
    // (treeKey++) and don't have to be re-fetched.
    commit(SET_NODE_CHILDREN, { nodeId: node.id, children });
    return children;
  },
  async [FETCH_WORKSPACES]({ commit }) {
    const { $axios } = this;
    try {
      commit(SET_ARE_LOADING_WORKSPACES, true);
      const { items: workspaces } = await $axios.$get(workspacesByGroup());
      const workspacesHasRight = workspaces?.filter(
        (workspace) => workspace?.hasRights
      );
      commit(SET_WORKSPACES, workspaces);
      commit(SET_WORKSPACES_HAS_RIGHT, workspacesHasRight);
      commit(SET_TREEVIEW_WORKSPACES, getTreeviewWorkspaces(workspaces));
      commit(
        SET_TREEVIEW_WORKSPACES_HASRIGHT,
        getTreeviewWorkspaces(workspacesHasRight)
      );
    } catch (error) {
      console.error('error while fetching workspaces');
    } finally {
      commit(SET_ARE_LOADING_WORKSPACES, false);
    }
  },
};
