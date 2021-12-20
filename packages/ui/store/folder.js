import {
  mailings,
  getWorkspace,
  getFolder,
  getFolderAccess,
  getWorkspaceAccess,
} from '~/helpers/api-routes';

import { parsePaginationData } from '~/utils/parsePagination';
import { PAGE, SHOW_SNACKBAR } from '~/store/page';

export const FOLDER = 'folder';
export const SET_FOLDER = 'SET_FOLDER';
export const SET_WORKSPACE = 'SET_WORKSPACE';
export const SET_HAS_ACCESS = 'SET_HAS_ACCESS';
export const SET_MAILINGS = 'SET_MAILINGS';
export const SET_TAGS = 'SET_TAGS';
export const SET_PAGINATION = 'SET_PAGINATION';
export const SET_FILTERS = 'SET_FILTERS';
export const SET_SORTBY = 'SET_SORTBY';
export const SET_LOADING_MAILINGS = 'SET_LOADING_MAILINGS';

export const FETCH_MAILINGS = 'fetchMailings';
export const FETCH_FOLDER_OR_WORKSPACE = 'fetchFolderOrWorkspace';

export const state = () => ({
  workspace: {},
  folder: {},
  hasAccess: false,
  pagination: {
    sortBy: ['updatedAt'],
    sortDesc: [true],
    page: 1,
    itemsPerPage: 10,
    pageStart: 0,
    pageStop: 10,
    pageCount: 1,
    itemsLength: 10,
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
  mailingsIsLoading: false,
});

export const getters = {};

// https://medium.com/vuetify/creating-reusable-snackbars-with-vuetify-and-vuex-a8c3fef7b206
export const mutations = {
  [SET_FOLDER](store, folder) {
    store.folder = folder;
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
  [SET_LOADING_MAILINGS](store, mailingsIsLoading) {
    store.mailingsIsLoading = mailingsIsLoading;
  },
  [SET_HAS_ACCESS](store, hasAccess) {
    store.hasAccess = hasAccess;
  },
};

export const actions = {
  async [FETCH_FOLDER_OR_WORKSPACE]({ commit, dispatch }, { query, $t }) {
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

        await dispatch(FETCH_MAILINGS, {
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
    }
  },
  async [FETCH_MAILINGS]({ commit, rootState }, { query, $t, pagination }) {
    commit(SET_LOADING_MAILINGS, true);
    if (!!query?.wid || !!query?.fid) {
      const queryMailing = rootState.folder.folder?.id
        ? { parentFolderId: query?.fid }
        : { workspaceId: query?.wid };

      try {
        const mailingsResponse = await this.$axios.$get(mailings(), {
          params: {
            ...queryMailing,
            pagination: {
              ...rootState.folder?.pagination,
              ...(pagination || {}),
            },
            filters: rootState.folder?.filters,
          },
        });
        const { docs, ...paginationsData } = mailingsResponse?.items;

        commit(SET_MAILINGS, docs);
        commit(SET_TAGS, mailingsResponse.meta?.tags);
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
      } finally {
        commit(SET_LOADING_MAILINGS, false);
      }
    }
  },
};
