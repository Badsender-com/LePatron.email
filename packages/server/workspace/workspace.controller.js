'use strict';

const asyncHandler = require('express-async-handler');
const createHttpError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const workspaceService = require('./workspace.service');

module.exports = {
  listWorkspace: asyncHandler(listWorkspace),
  hasAccess: asyncHandler(hasAccess),
  createWorkspace: asyncHandler(createWorkspace),
  getWorkspace: asyncHandler(getWorkspace),
  updateWorkspace: asyncHandler(updateWorkspace),
  deleteWorkspace: asyncHandler(deleteWorkspace),
};

/**
 * @api {get} /workspaces/:workspaceId/has-access workspace access
 * @apiPermission regular_user
 * @apiName GetWorkspaceAccess
 * @apiGroup Workspaces
 *
 * @apiParam {string} workspaceId
 *
 * @apiUse workspace
 */

async function hasAccess(req, res) {
  const {
    user,
    params: { workspaceId },
  } = req;

  const hasAccess = await workspaceService.hasAccess(user, workspaceId);

  res.json({ hasAccess });
}

/**
 * @api {get} /workspace list of workspaces with folders
 * @apiPermission group_admin
 * @apiName GetWorkspaces
 * @apiGroup Workspaces
 *
 * @apiUse workspace
 * @apiSuccess {workspace[]} items list of workspace
 */

async function listWorkspace(req, res, next) {
  if (!req?.user) {
    next(new createHttpError.Unauthorized());
  }
  const user = req.user;
  const { group } = user;
  const workspaces = await workspaceService.findWorkspacesWithRights({
    groupId: group.id,
    userId: user.id,
    isGroupAdmin: user.isGroupAdmin,
  });

  return res.json({ items: workspaces });
}

/**
 * @api {post} /workspaces workspace creation
 * @apiPermission group_admin
 * @apiName CreateWorkspace
 * @apiGroup Workspaces
 *
 * @apiParam (Body) {String} groupId the group of the workspace
 * @apiParam (Body) {String} email should be unique in the application
 * @apiParam (Body) {String} [name]
 * @apiParam (Body) {String} [description]
 * @apiParam (Body) {Array} [userIds] Ids of the workspace's members
 *
 * @apiUse workspace
 * @apiSuccess {workspace} workspace created
 */

async function createWorkspace(req, res) {
  try {
    // Super admins can create workspaces for any group
    // Group admins can only create workspaces for their own group
    const isAdmin = req.user?.isAdmin;
    const isGroupAdmin = req.user?.isGroupAdmin;
    const userGroupId = req.user?.group?.id;
    const targetGroupId = req.body.groupId;

    const canCreate =
      isAdmin || (isGroupAdmin && userGroupId && userGroupId === targetGroupId);

    if (canCreate) {
      const newWorkspace = await workspaceService.createWorkspace(req.body);
      res.json(newWorkspace);
    } else {
      res.status(403).send(ERROR_CODES.FORBIDDEN_WORKSPACE_CREATION);
    }
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}

/**
 * @api {put} /workspaces/:workspaceId workspace
 * @apiPermission group_admin
 * @apiName UpdateWorkspace
 * @apiGroup Workspaces
 *
 * @apiParam (Body) {String} [name]
 *
 * @apiUse workspace
 * @apiSuccess {workspace} workspace updated
 */

async function updateWorkspace(req, res) {
  try {
    const { selectedUsers, ...otherProperties } = req.body;
    const workspace = {
      id: req.params.workspaceId,
      _users: (selectedUsers && selectedUsers.map((user) => user.id)) || [],
      ...otherProperties,
    };
    await workspaceService.updateWorkspace(workspace);
    res.send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}

/**
 * @api {delete} /workspaces/:workspaceId workspace delete
 * @apiPermission group_admin
 * @apiName DeleteWorkspace
 * @apiGroup Workspaces
 *
 * @apiUse workspace
 * @apiSuccess {workspace} workspace deleted
 */

async function deleteWorkspace(req, res) {
  const { workspaceId } = req.params;
  const { user } = req;

  try {
    const workspace = await workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).send(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }

    // Super admins can delete any workspace
    // Group admins can only delete workspaces from their group
    const isAdmin = user?.isAdmin;
    const userGroupId = user?.group?.id;
    const workspaceGroupId = workspace._company?.toString();

    if (!isAdmin && workspaceGroupId !== userGroupId) {
      return res.status(403).send(ERROR_CODES.FORBIDDEN_WORKSPACE_RETRIEVAL);
    }

    await workspaceService.deleteWorkspace(workspaceId);
    res.status(204).send();
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}

/**
 * @api {get} /workspaces/:workspaceId workspace
 * @apiPermission regular_user
 * @apiName GetWorkspace
 * @apiGroup Workspaces
 *
 * @apiParam {string} workspaceId
 *
 * @apiUse group
 */

async function getWorkspace(req, res) {
  try {
    const { workspaceId } = req.params;
    const { user } = req;

    if (workspaceId === 'undefined') {
      return res.status(404).send(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }

    const workspace = await workspaceService.getWorkspaceWithAccessRight(
      workspaceId,
      user
    );

    // Super admins can access any workspace
    // Group admins/users can only access workspaces from their group
    const isAdmin = user?.isAdmin;
    const userGroupId = user?.group?.id;
    const workspaceGroupId = `${workspace._company}`;

    if (!isAdmin && workspaceGroupId !== userGroupId) {
      return res.status(404).send(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }

    res.json(workspace);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).send(error.message);
    }
    res.status(500).send();
  }
}
