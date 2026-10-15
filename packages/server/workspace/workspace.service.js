'use strict';

const {
  Workspaces,
  Mailings,
  Folders,
  Groups,
} = require('../common/models.common.js');
const mongoose = require('mongoose');
const ERROR_CODES = require('../constant/error-codes.js');
const { Conflict, NotFound, Forbidden } = require('http-errors');
const logger = require('../utils/logger');
const permissions = require('../account/permissions.js');
const { refuseBootstrapAccount } = require('../account/request-scope.js');

module.exports = {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspace,
  findWorkspaces,
  findWorkspacesWithRights,
  getWorkspaceWithAccessRight,
  doesUserHaveWriteAccess,
  doesUserHaveReadAccess,
  hasAccess,
  assertAccess,
  isWorkspaceInGroup,
  deleteFolderContent,
};

async function existsByName({ workspaceId, workspaceName, groupId }) {
  return Workspaces.exists({
    _id: { $ne: mongoose.Types.ObjectId(workspaceId) },
    name: workspaceName,
    _company: groupId,
  });
}

async function getWorkspace(id) {
  if (!(await Workspaces.exists({ _id: mongoose.Types.ObjectId(id) }))) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  return Workspaces.findById(id).populate({
    path: 'folders',
  });
}

async function hasAccess(user, workspaceId) {
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
  // A module write: the bootstrap account stays in the settings.
  refuseBootstrapAccount(user);
  return permissions.canWriteWorkspace(user, workspace);
}

/**
 * Throws unless the user may write in the workspace, like the folder check:
 * `hasAccess` answers a boolean, which a caller can forget to read.
 */
async function assertAccess(user, workspaceId) {
  if (!(await hasAccess(user, workspaceId))) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
}

async function getWorkspaceWithAccessRight(id, user) {
  const workspace = await getWorkspace(id);
  const group = await Groups.findById(workspace._company);

  if (!permissions.canReadWorkspace(user, workspace, group)) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }

  let workspaceWithAccess = {
    ...workspace?.toObject(),
    hasAccess: false,
  };

  if (permissions.canWriteWorkspace(user, workspace)) {
    workspaceWithAccess = {
      ...workspaceWithAccess,
      hasAccess: true,
    };
  }

  return workspaceWithAccess;
}

async function deleteWorkspace(workspaceId) {
  return Workspaces.deleteOne({ _id: workspaceId }, async () => {
    logger.log('deleting workspace:', workspaceId);
    await Mailings.deleteMany({ _workspace: workspaceId });
    const foldersToDelete = await Folders.find({ _workspace: workspaceId });
    if (foldersToDelete && foldersToDelete.length > 0) {
      foldersToDelete?.forEach((folder) => deleteFolderContent(folder?.id));
    }
    await Folders.deleteMany({ _workspace: workspaceId });
  });
}

async function deleteFolderContent(folderId) {
  logger.log('deleting folder:', folderId);
  const folderContent = await Folders.find({ _parentFolder: folderId });
  if (folderContent && folderContent.length > 0) {
    folderContent.forEach((folder) => {
      deleteFolderContent(folder?.id);
    });
  }
  await Mailings.deleteMany({ _parentFolder: folderId });
  await Folders.deleteMany({ _parentFolder: folderId });
}

async function createWorkspace(workspace) {
  if (!workspace || !workspace.groupId) {
    throw new NotFound(ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Validate that the target group exists. The previous controller path
  // implicitly enforced this by checking `targetGroupId === req.user.group.id`,
  // which only ever passed for a real group; the super-admin path skipped
  // that comparison and could create orphan workspaces (with a _company
  // pointing at a non-existent group) until a downstream consumer broke.
  // Lean+_id-only so we never leak module flags or FTP config here.
  const group = await Groups.findById(workspace.groupId).select('_id').lean();
  if (!group) {
    throw new NotFound(ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (
    await existsByName({
      workspaceId: null,
      workspaceName: workspace?.name,
      groupId: workspace?.groupId,
    })
  ) {
    throw new Conflict(ERROR_CODES.WORKSPACE_ALREADY_EXISTS);
  }
  const newWorkspace = await Workspaces.create({
    name: workspace.name,
    description: workspace.description || '',
    _company: workspace.groupId,
    _users:
      (workspace.selectedUsers &&
        workspace.selectedUsers.map((user) => user.id)) ||
      [],
  });

  return newWorkspace;
}

async function updateWorkspace(workspace) {
  if (
    await existsByName({
      workspaceId: workspace.id,
      workspaceName: workspace?.name,
      groupId: workspace?.groupId,
    })
  ) {
    throw new Conflict(ERROR_CODES.WORKSPACE_ALREADY_EXISTS);
  }

  const { id, ...otherProperties } = workspace;

  return Workspaces.updateOne(
    { _id: mongoose.Types.ObjectId(id) },
    { ...otherProperties }
  );
}

async function findWorkspaces({ groupId }) {
  // Only load root folders for the initial tree; children are lazy-loaded on
  // expand via GET /folders/:folderId/children. The nested `childFolders`
  // populate (which loaded the whole hierarchy in one query and froze the UI
  // for large companies) has been removed.
  const workspaces = await Workspaces.find({ _company: groupId })
    .populate({
      path: 'users',
    })
    .populate({
      path: 'folders',
      options: { sort: { name: 1 } },
    });

  // to discard nested folders as direct children of each workspace
  workspaces.forEach((workspace) => {
    if (workspace.folders) {
      workspace.folders = workspace.folders?.filter(
        (folder) => !folder._parentFolder
      );
    }
  });

  // Return plain objects so the computed `hasChildren` flag survives (a later
  // `.toObject()` on a Mongoose doc would regenerate `folders` from the virtual
  // and drop it).
  const plainWorkspaces = workspaces.map((workspace) => workspace.toObject());

  await attachHasChildrenFlag(plainWorkspaces);

  return plainWorkspaces;
}

// Computes, in a single aggregation, which of the supplied root folders have
// at least one child folder — so the tree can show an expand arrow only where
// relevant without populating the whole hierarchy.
async function attachHasChildrenFlag(workspaces) {
  const rootFolderIds = workspaces
    .flatMap((workspace) => workspace.folders || [])
    .map((folder) => folder._id);

  if (rootFolderIds.length === 0) {
    return;
  }

  const parentsWithChildren = await Folders.aggregate([
    { $match: { _parentFolder: { $in: rootFolderIds } } },
    { $group: { _id: '$_parentFolder' } },
  ]);
  const parentsWithChildrenSet = new Set(
    parentsWithChildren.map((doc) => doc._id.toString())
  );

  workspaces.forEach((workspace) => {
    if (workspace.folders) {
      workspace.folders = workspace.folders.map((folder) => ({
        ...folder,
        hasChildren: parentsWithChildrenSet.has(folder._id.toString()),
      }));
    }
  });
}

// The workspace tree of a group: the workspaces the user may read, each with
// whether it may write in it (ADR 0002, amended).
async function findWorkspacesWithRights({ groupId, user }) {
  const workspaces = await findWorkspaces({ groupId });
  const group = await Groups.findById(groupId);

  // findWorkspaces already returns plain objects (folders enriched with
  // `hasChildren`), so no `.toObject()` is needed here.
  return (workspaces || [])
    .filter((workspace) => permissions.canReadWorkspace(user, workspace, group))
    .map((workspace) => ({
      ...workspace,
      hasRights: permissions.canWriteWorkspace(user, workspace),
    }))
    .sort((a, b) => b.hasRights - a.hasRights || a.name?.localeCompare(b.name));
}

function isWorkspaceInGroup(workspace, groupId) {
  return workspace?.group.toString() === groupId;
}

function doesUserHaveWriteAccess(user, workspace) {
  // A module write: the bootstrap account stays in the settings.
  refuseBootstrapAccount(user);
  doesUserHaveReadAccess(user, workspace);

  if (!permissions.canWriteWorkspace(user, workspace)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }
}

// The workspace is in a group the user reaches: its own, or any group for a
// super admin. Whether it may read the workspace's content is
// `canReadWorkspace`'s business.
function doesUserHaveReadAccess(user, workspace) {
  if (
    !isWorkspaceInGroup(workspace, user?.group?.id) &&
    !permissions.canManageGroup(user, workspace?.group)
  ) {
    throw new NotFound(
      `${ERROR_CODES.WORKSPACE_NOT_FOUND} : ${workspace.name}`
    );
  }
}
