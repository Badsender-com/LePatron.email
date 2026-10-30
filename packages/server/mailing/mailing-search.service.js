'use strict';

const { BadRequest, ServiceUnavailable } = require('http-errors');
const mongoose = require('mongoose');

const ERROR_CODES = require('../constant/error-codes.js');
const {
  Groups,
  Workspaces,
  Folders,
  Mailings,
} = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { listingGroupIdOf } = require('../account/request-scope.js');

// Searching every accessible workspace (ADR 0007): the emails of every
// workspace the user may read in the group the listing reads, in any folder or
// subfolder. The database applies the rights, before pagination, on the
// explicit list of accessible locations: there is no shortcut for the users
// who read the whole group, so one rule decides what can come back.

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;
// Far beyond the largest group: a deeper page is a mistake, not a need.
const MAX_PAGE = 10000;
// What one search may cost the database, on its page and on its count.
const MAX_TIME_MS = 5000;
// MongoDB's code when a query runs out of its time.
const MAX_TIME_EXPIRED = 50;
// The columns of the listing that sort; anything else falls back to the most
// recently updated first.
const SORTABLE = ['name', 'userName', 'templateName', 'createdAt', 'updatedAt'];
const MOST_RECENT_FIRST = { sortBy: ['updatedAt'], sortDesc: [true] };

module.exports = { searchMailings };

/**
 * @param {Object} params
 * @param {Object} params.user the request user
 * @param {Object} params.filters the listing's filters
 * @param {Object} params.pagination the listing's pagination
 * @returns {Promise<{ meta: Object, items: Object }>} the listing's answer,
 *   each email with its `location` and whether the user may open it
 *   (`hasAccess`)
 */
async function searchMailings({ user, filters = {}, pagination = {} }) {
  const groupId = listingGroupIdOf(user);
  const page = pageOf(pagination);

  const workspaces = await accessibleWorkspaces(user, groupId);
  const folders = await foldersOf(workspaces);

  const items = await findPage({
    _company: mongoose.Types.ObjectId(groupId),
    $or: [
      { _parentFolder: { $in: folders.map((folder) => folder._id) } },
      // An email in a folder is found through its folder only: a workspace
      // it may still name never lets it through.
      {
        _workspace: { $in: workspaces.map((workspace) => workspace._id) },
        _parentFolder: null,
      },
    ],
    paginationJSON: page,
    filtersJSON: filters,
    maxTimeMS: MAX_TIME_MS,
  });

  const locate = locator(workspaces, folders);
  return {
    meta: {},
    items: {
      ...items,
      docs: items.docs.map((mailing) => {
        const { location, workspace } = locate(mailing);
        return {
          ...mailing,
          location,
          hasAccess: permissions.canWriteWorkspace(user, workspace),
        };
      }),
    },
  };
}

async function findPage(query) {
  try {
    return await Mailings.findForApiWithPagination(query);
  } catch (error) {
    if (error && error.code === MAX_TIME_EXPIRED) {
      throw new ServiceUnavailable(ERROR_CODES.SEARCH_TIMEOUT);
    }
    throw error;
  }
}

// The page the database serves: 25 emails unless asked, 100 at most, "All"
// refused, and the most recently updated first unless a column is sorted.
function pageOf({ page, itemsPerPage, sortBy, sortDesc }) {
  const size =
    itemsPerPage === undefined ? DEFAULT_PAGE_SIZE : Number(itemsPerPage);
  if (!Number.isInteger(size) || size < 1) {
    throw new BadRequest(ERROR_CODES.INVALID_PAGE_SIZE);
  }
  const pageNumber = page === undefined ? 1 : Number(page);
  if (
    !Number.isInteger(pageNumber) ||
    pageNumber < 1 ||
    pageNumber > MAX_PAGE
  ) {
    throw new BadRequest(ERROR_CODES.BAD_FORMAT_PAGINATION);
  }
  const sorted =
    Array.isArray(sortBy) &&
    Array.isArray(sortDesc) &&
    SORTABLE.includes(sortBy[0]);
  return {
    page: pageNumber,
    itemsPerPage: Math.min(size, MAX_PAGE_SIZE),
    ...(sorted
      ? { sortBy: [sortBy[0]], sortDesc: [!!sortDesc[0]] }
      : MOST_RECENT_FIRST),
  };
}

async function accessibleWorkspaces(user, groupId) {
  const [group, workspaces] = await Promise.all([
    Groups.findById(groupId).select('userHasAccessToAllWorkspaces').lean(),
    Workspaces.find({ _company: groupId })
      .select('name _company _users')
      .lean(),
  ]);
  return workspaces.filter((workspace) =>
    permissions.canReadWorkspace(user, workspace, group)
  );
}

// The folders of the workspaces, then their subfolders. A subfolder is known
// by its parent folder: one from older data may still name a workspace.
async function foldersOf(workspaces) {
  const rootFolders = await Folders.find({
    _workspace: { $in: workspaces.map((workspace) => workspace._id) },
    _parentFolder: null,
  })
    .select('name _workspace _parentFolder')
    .lean();
  const subfolders = await Folders.find({
    _parentFolder: { $in: rootFolders.map((folder) => folder._id) },
  })
    .select('name _workspace _parentFolder')
    .lean();
  return [...rootFolders, ...subfolders];
}

// Where an email sits, from the workspace down, read from its folder's parent
// before any workspace it names (a move leaves `null` in the field it left).
function locator(workspaces, folders) {
  const byId = (list) => new Map(list.map((item) => [String(item._id), item]));
  const workspaceById = byId(workspaces);
  const folderById = byId(folders);
  const reference = ({ _id, name }) => ({ id: String(_id), name });

  return function locate(mailing) {
    if (!mailing._parentFolder) {
      const workspace = workspaceById.get(String(mailing._workspace));
      return { workspace, location: { workspace: reference(workspace) } };
    }
    const folder = folderById.get(String(mailing._parentFolder));
    if (!folder._parentFolder) {
      const workspace = workspaceById.get(String(folder._workspace));
      return {
        workspace,
        location: {
          workspace: reference(workspace),
          folder: reference(folder),
        },
      };
    }
    const parent = folderById.get(String(folder._parentFolder));
    const workspace = workspaceById.get(String(parent._workspace));
    return {
      workspace,
      location: {
        workspace: reference(workspace),
        folder: reference(parent),
        subfolder: reference(folder),
      },
    };
  };
}
