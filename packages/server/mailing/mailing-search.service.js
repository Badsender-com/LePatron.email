'use strict';

const { BadRequest, ServiceUnavailable } = require('http-errors');
const mongoose = require('mongoose');

const ERROR_CODES = require('../constant/error-codes.js');
const { Mailings, TaxonomyItems } = require('../common/models.common.js');
const { TaxonomyTypes } = require('../constant/taxonomy-type.js');
const { containing, containingRegExp } = require('../utils/text-search.js');
const permissions = require('../account/permissions.js');
const { listingGroupIdOf } = require('../account/request-scope.js');
const { isObjectIdString } = require('../utils/model.js');
const {
  accessibleWorkspaces,
  foldersOf,
  scopeOf,
  locator,
} = require('./mailing-locations.js');

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
  findReadableMailings,
  findReadableMailing,
  locateReadableMailing,
};

/**
 * @param {Object} params
 * @param {Object} params.user the request user
 * @param {Object} params.filters the listing's filters
 * @param {Object} params.pagination the listing's pagination
 * @param {Object} [params.within] narrows the search, never beyond what the
 *   user may read: by location, `workspaceIds` and `folderIds` (a folder with
 *   its subfolders; one the user may not read finds nothing); by author,
 *   `userIds` (their accounts) or `authorName` (a part of their name); by
 *   name, `name` (a part of the email's name); by text, `words` (each one in
 *   the name, the subject, a tag or the email type's label). Texts match
 *   whatever their case and accents.
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
    ...narrowedBy(within),
    ...(await wordsFilter(within, groupId)),
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

/**
 * A mailing the user may read (`findReadableMailings`), and where it sits, or
 * null: what is read of it is read only once the rule let it through.
 *
 * @param {Object} user the request user
 * @param {string} id
 * @param {string} fields the fields to read, space separated, kept (`name
 *   subject`) or left out (`-data`); where the email sits is always read
 * @returns {Promise<{ mailing: Object, location: Object }|null>}
 */
async function locateReadableMailing(user, id, fields) {
  if (!isObjectIdString(id)) return null;
  const { workspaces, folders, readable } = await readableScope(
    user,
    listingGroupIdOf(user)
  );
  const leavesOut = fields.split(/\s+/).every((field) => field.startsWith('-'));
  const [mailing] = await Mailings.find(
    { ...readable, _id: { $in: [id] } },
    leavesOut ? fields : `${fields} _workspace _parentFolder`
  ).lean();
  if (!mailing) return null;
  return { mailing, location: locator(workspaces, folders)(mailing).location };
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

// What a search keeps besides its locations: the authors, by account or by a
// part of their name, and the emails by a part of their name.
function narrowedBy({ userIds, authorName, name } = {}) {
  return {
    ...(userIds && {
      _user: { $in: userIds.map((id) => mongoose.Types.ObjectId(String(id))) },
    }),
    ...(authorName && { author: containing(authorName) }),
    ...(name && { name: containing(name) }),
  };
}

// Every word somewhere in what describes an email, whatever its case and
// accents: its name, its subject, a tag or its email type's label. Never its
// content.
async function wordsFilter({ words } = {}, groupId) {
  const kept = (words || []).map(String).filter(Boolean);
  if (kept.length === 0) return {};
  const types = await TaxonomyItems.find({
    _company: groupId,
    type: TaxonomyTypes.EMAIL_TYPE,
  })
    .select('label')
    .lean();
  return {
    $and: kept.map((word) => {
      const pattern = containingRegExp(word);
      const typeIds = types
        .filter((type) => pattern.test(type.label))
        .map((type) => type._id);
      return {
        $or: [
          { name: containing(word) },
          { subject: containing(word) },
          { tags: containing(word) },
          ...(typeIds.length ? [{ _emailType: { $in: typeIds } }] : []),
        ],
      };
    }),
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
