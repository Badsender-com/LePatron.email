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
const { isObjectIdString } = require('../utils/model.js');

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

// What a check of a right reads of a mailing when the caller names nothing:
// its id, never its content (`data`, `previewHtml`).
const ID_ONLY = Object.freeze({ _id: 1 });

module.exports = {
  searchMailings,
  accessibleLocations,
  findReadableMailings,
  findReadableMailing,
};

/**
 * @param {Object} params
 * @param {Object} params.user the request user
 * @param {Object} params.filters the listing's filters
 * @param {Object} params.pagination the listing's pagination
 * @param {Object} [params.within] narrows the search, among the accessible
 *   locations only: `workspaceIds`, `folderIds` (a folder with its
 *   subfolders), `userIds` (the authors' accounts) and `authorName` (a part of
 *   the author's name, whatever the case). A location the user may not read
 *   finds nothing.
 * @returns {Promise<{ meta: Object, items: Object }>} the listing's answer,
 *   each email with its `location` and whether the user may open it
 *   (`hasAccess`)
 */
async function searchMailings({
  user,
  filters = {},
  pagination = {},
  within = {},
}) {
  const groupId = listingGroupIdOf(user);
  const page = pageOf(pagination);

  const { workspaces, folders, readable } = await readableScope(
    user,
    groupId,
    within
  );

  const items = await findPage({
    ...readable,
    ...authorsOf(within),
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

/**
 * The mailings among `ids` the user may read, by the rule of the search
 * (ADR 0007): in the group the user reads (a super admin's selected group),
 * in a workspace they may read or one of its folders. A check of a right,
 * one query for all of them once the locations are known.
 *
 * @param {Object} user the request user
 * @param {string[]} ids mailing ids; anything but an id string is not found
 * @param {Object|string} [projection] what is read of each mailing, its id
 *   alone unless named
 * @returns {Promise<Object[]>} the mailings found, lean
 */
async function findReadableMailings(user, ids, projection = ID_ONLY) {
  const wanted = [...new Set(ids.filter(isObjectIdString))];
  if (!wanted.length) return [];
  const { readable } = await readableScope(user, listingGroupIdOf(user));
  return Mailings.find(
    { ...readable, _id: { $in: wanted } },
    projection
  ).lean();
}

/**
 * A mailing the user may read (`findReadableMailings`), or null.
 *
 * @param {Object} user the request user
 * @param {string} id
 * @param {Object|string} [projection]
 * @returns {Promise<Object|null>}
 */
async function findReadableMailing(user, id, projection) {
  const [found] = await findReadableMailings(user, [id], projection);
  return found || null;
}

// What the user may read in a group, as a filter on its mailings, with the
// workspaces and folders it lists; a search may narrow the filter (`within`,
// see scopeOf), never beyond what the user may read.
async function readableScope(user, groupId, within = {}) {
  const workspaces = await accessibleWorkspaces(user, groupId);
  const folders = await foldersOf(workspaces);
  const scope = scopeOf(workspaces, folders, within);
  return {
    workspaces,
    folders,
    readable: {
      _company: mongoose.Types.ObjectId(groupId),
      $or: [
        { _parentFolder: { $in: scope.folders.map((folder) => folder._id) } },
        // An email in a folder is found through its folder only: a workspace
        // it may still name never lets it through.
        {
          _workspace: {
            $in: scope.workspaces.map((workspace) => workspace._id),
          },
          _parentFolder: null,
        },
      ],
    },
  };
}

// The authors a search keeps, by account or by a part of their name.
function authorsOf({ userIds, authorName } = {}) {
  return {
    ...(userIds && {
      _user: { $in: userIds.map((id) => mongoose.Types.ObjectId(String(id))) },
    }),
    ...(authorName && {
      author: {
        $regex: String(authorName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        $options: 'i',
      },
    }),
  };
}

// The locations a search looks through: every accessible one, or those the
// caller narrows it to. A folder brings its subfolders, and only the emails
// filed in them; a workspace brings its emails and its folders.
function scopeOf(workspaces, folders, { workspaceIds, folderIds } = {}) {
  // An empty list narrows nothing: it is a filter left blank.
  const named = (ids) => (ids && ids.length ? new Set(ids.map(String)) : null);
  const keptWorkspaces = named(workspaceIds);
  const inWorkspaces = keptWorkspaces
    ? workspaces.filter((workspace) =>
        keptWorkspaces.has(String(workspace._id))
      )
    : workspaces;
  const workspaceIdsKept = new Set(inWorkspaces.map((w) => String(w._id)));
  const parentOf = new Map(
    folders.map((folder) => [String(folder._id), folder])
  );
  const workspaceOfFolder = (folder) =>
    String(
      folder._parentFolder
        ? parentOf.get(String(folder._parentFolder))?._workspace
        : folder._workspace
    );
  let kept = folders.filter((folder) =>
    workspaceIdsKept.has(workspaceOfFolder(folder))
  );
  const keptFolders = named(folderIds);
  if (keptFolders) {
    kept = kept.filter(
      (folder) =>
        keptFolders.has(String(folder._id)) ||
        keptFolders.has(String(folder._parentFolder))
    );
    return { workspaces: [], folders: kept };
  }
  return { workspaces: inWorkspaces, folders: kept };
}

/**
 * The workspaces a user may read in the group the listing reads, each with its
 * folders and their subfolders: where a search may look.
 *
 * @param {Object} user the request user
 * @returns {Promise<Array<{ id: string, name: string, folders: Array }>>}
 */
async function accessibleLocations(user) {
  const workspaces = await accessibleWorkspaces(user, listingGroupIdOf(user));
  const folders = await foldersOf(workspaces);
  const reference = ({ _id, name }) => ({ id: String(_id), name });
  const byName = (a, b) => a.name.localeCompare(b.name);
  const childrenOf = (parentId) =>
    folders
      .filter((folder) => String(folder._parentFolder) === parentId)
      .map(reference)
      .sort(byName);
  return workspaces
    .map((workspace) => ({
      ...reference(workspace),
      folders: folders
        .filter(
          (folder) =>
            !folder._parentFolder &&
            String(folder._workspace) === String(workspace._id)
        )
        .map((folder) => ({
          ...reference(folder),
          subfolders: childrenOf(String(folder._id)),
        }))
        .sort(byName),
    }))
    .sort(byName);
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
