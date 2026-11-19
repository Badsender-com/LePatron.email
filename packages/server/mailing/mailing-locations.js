'use strict';

const { Groups, Workspaces, Folders } = require('../common/models.common.js');
const permissions = require('../account/permissions.js');
const { listingGroupIdOf } = require('../account/request-scope.js');

// The locations a search across accessible workspaces looks through (ADR
// 0007): the workspaces a user may read in a group, their folders and their
// subfolders, and where each email sits among them.

const reference = ({ _id, name }) => ({ id: String(_id), name });
const byId = (list) => new Map(list.map((item) => [String(item._id), item]));

/**
 * The workspaces a user may read in a group, by the listing's own rule.
 *
 * @param {Object} user the request user
 * @param {string} groupId
 * @returns {Promise<Object[]>} lean workspaces
 */
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

/**
 * The folders of the workspaces, then their subfolders. A subfolder is known
 * by its parent folder: one from older data may still name a workspace.
 *
 * @param {Object[]} workspaces
 * @returns {Promise<Object[]>} lean folders, the root ones first
 */
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

// The one walk of the folder tree: where a folder sits, from the workspace
// down, read from a subfolder's parent before any workspace it names (a move
// leaves `null` in the field it left). Null for a folder out of the tree.
function placeOfFolders(workspaces, folders) {
  const workspaceById = byId(workspaces);
  const folderById = byId(folders);
  return function placeOf(folder) {
    if (!folder) return null;
    if (!folder._parentFolder) {
      const workspace = workspaceById.get(String(folder._workspace));
      return workspace ? { workspace, folder } : null;
    }
    const parent = folderById.get(String(folder._parentFolder));
    const workspace = parent && workspaceById.get(String(parent._workspace));
    return workspace ? { workspace, folder: parent, subfolder: folder } : null;
  };
}

/**
 * The locations a search looks through: every accessible one, or those the
 * caller narrows it to. A folder brings its subfolders, and only the emails
 * filed in them; a workspace brings its emails and its folders.
 *
 * @param {Object[]} workspaces the accessible workspaces
 * @param {Object[]} folders their folders and subfolders
 * @param {Object} [within] `workspaceIds`, `folderIds`
 * @returns {{ workspaces: Object[], folders: Object[] }}
 */
function scopeOf(workspaces, folders, { workspaceIds, folderIds } = {}) {
  // An empty list narrows nothing: it is a filter left blank.
  const named = (ids) => (ids && ids.length ? new Set(ids.map(String)) : null);
  const keptWorkspaces = named(workspaceIds);
  const inWorkspaces = keptWorkspaces
    ? workspaces.filter((workspace) =>
        keptWorkspaces.has(String(workspace._id))
      )
    : workspaces;
  const placeOf = placeOfFolders(inWorkspaces, folders);
  const kept = folders.filter((folder) => placeOf(folder));
  const keptFolders = named(folderIds);
  if (keptFolders) {
    return {
      workspaces: [],
      folders: kept.filter(
        (folder) =>
          keptFolders.has(String(folder._id)) ||
          keptFolders.has(String(folder._parentFolder))
      ),
    };
  }
  return { workspaces: inWorkspaces, folders: kept };
}

/**
 * Where an email sits, from the workspace down, and the workspace it is in.
 *
 * @param {Object[]} workspaces
 * @param {Object[]} folders
 * @returns {function(Object): { workspace: Object, location: Object }}
 */
function locator(workspaces, folders) {
  const workspaceById = byId(workspaces);
  const folderById = byId(folders);
  const placeOf = placeOfFolders(workspaces, folders);

  return function locate(mailing) {
    if (!mailing._parentFolder) {
      const workspace = workspaceById.get(String(mailing._workspace));
      return { workspace, location: { workspace: reference(workspace) } };
    }
    const { workspace, folder, subfolder } = placeOf(
      folderById.get(String(mailing._parentFolder))
    );
    return {
      workspace,
      location: {
        workspace: reference(workspace),
        folder: reference(folder),
        ...(subfolder && { subfolder: reference(subfolder) }),
      },
    };
  };
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
  const placeOf = placeOfFolders(workspaces, folders);
  const byName = (a, b) => a.name.localeCompare(b.name);
  const tree = new Map(workspaces.map((workspace) => [workspace, new Map()]));
  folders.forEach((folder) => {
    const place = placeOf(folder);
    if (!place) return;
    const rootFolders = tree.get(place.workspace);
    if (!rootFolders.has(place.folder)) rootFolders.set(place.folder, []);
    if (place.subfolder) rootFolders.get(place.folder).push(place.subfolder);
  });
  return [...tree]
    .map(([workspace, rootFolders]) => ({
      ...reference(workspace),
      folders: [...rootFolders]
        .map(([folder, subfolders]) => ({
          ...reference(folder),
          subfolders: subfolders.map(reference).sort(byName),
        }))
        .sort(byName),
    }))
    .sort(byName);
}

module.exports = {
  accessibleWorkspaces,
  foldersOf,
  scopeOf,
  locator,
  accessibleLocations,
};
