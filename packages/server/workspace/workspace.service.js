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

module.exports = {
  createWorkspace,
  updateWorkspace,
  deleteWorkspace,
  getWorkspace,
  findWorkspaces,
  findWorkspacesWithRights,
  getWorkspaceWithAccessRight,
  workspaceContainsUser,
  doesUserHaveWriteAccess,
  doesUserHaveReadAccess,
  hasAccess,
  isWorkspaceInGroup,
  isUserWorkspaceMember,
  deleteFolderContent,
  restrictAccessingWorkspacesForNonMemberUser,
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

async function restrictAccessingWorkspacesForNonMemberUser(
  workspace,
  user,
  group
) {
  return (
    !workspaceContainsUser(workspace, user) &&
    group.userHasAccessToAllWorkspaces === false
  );
}

async function hasAccess(user, workspaceId) {
  const workspace = await getWorkspace(workspaceId);

  if (!workspace) {
    throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
  }
  return (
    isWorkspaceInGroup(workspace, user.group.id) &&
    isUserWorkspaceMember(user, workspace)
  );
}

async function getWorkspaceWithAccessRight(id, user) {
  const workspace = await getWorkspace(id);
  const group = await Groups.findById(workspace._company);

  // Super admins have full access to all workspaces
  const isAdmin = user?.isAdmin;
  const isGroupAdmin = user?.isGroupAdmin;

  if (!isAdmin && !isGroupAdmin) {
    if (
      await restrictAccessingWorkspacesForNonMemberUser(workspace, user, group)
    ) {
      throw new NotFound(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }
  }

  let workspaceWithAccess = {
    ...workspace?.toObject(),
    hasAccess: false,
  };

  if (
    isAdmin ||
    isGroupAdmin ||
    workspaceContainsUser(workspaceWithAccess, user)
  ) {
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

async function findWorkspacesWithRights({ groupId, userId, isGroupAdmin }) {
  const workspaces = await findWorkspaces({ groupId });
  const group = await Groups.findById(groupId);

  // findWorkspaces already returns plain objects (folders enriched with
  // `hasChildren`), so no `.toObject()` is needed here.
  let workspacesWithRights = workspaces?.map((workspace) => ({
    ...workspace,
    hasRights: true,
  }));

  if (!isGroupAdmin) {
    workspacesWithRights = workspacesWithRights
      .filter(
        (workspace) =>
          (!group.userHasAccessToAllWorkspaces &&
            workspace._users?.toString().includes(userId)) ||
          group.userHasAccessToAllWorkspaces
      )
      .map((workspace) => {
        if (!workspace._users?.toString().includes(userId)) {
          return {
            ...workspace,
            hasRights: false,
          };
        }
        return workspace;
      });
  }

  return workspacesWithRights.sort(
    (a, b) => b.hasRights - a.hasRights || a.name?.localeCompare(b.name)
  );
}

function isWorkspaceInGroup(workspace, groupId) {
  return workspace?.group.toString() === groupId;
}

function workspaceContainsUser(workspace, user) {
  return workspace._users?.toString().includes(user.id);
}

function isUserWorkspaceMember(user, workspace) {
  if (user.isGroupAdmin) {
    return true;
  }
  return workspaceContainsUser(workspace, user);
}

function doesUserHaveWriteAccess(user, workspace) {
  doesUserHaveReadAccess(user, workspace);

  if (!isUserWorkspaceMember(user, workspace)) {
    throw new Forbidden(ERROR_CODES.FORBIDDEN_RESOURCE_OR_ACTION);
  }
}

function doesUserHaveReadAccess(user, workspace) {
  if (!isWorkspaceInGroup(workspace, user?.group?.id)) {
    throw new NotFound(
      `${ERROR_CODES.WORKSPACE_NOT_FOUND} : ${workspace.name}`
    );
  }
}
