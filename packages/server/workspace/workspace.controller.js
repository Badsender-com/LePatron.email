'use strict';

const asyncHandler = require('express-async-handler');
const { pick } = require('lodash');
const createHttpError = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const workspaceService = require('./workspace.service');
const { listingGroupIdOf } = require('../account/request-scope.js');
const permissions = require('../account/permissions.js');

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
  const workspaces = await workspaceService.findWorkspacesWithRights({
    groupId: listingGroupIdOf(user),
    user,
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
    // Whoever manages the group: its company admin, or a super admin.
    const canCreate = permissions.canManageGroup(req.user, req.body.groupId);

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

// What the workspace form sets; the membership toggle of a user's page sends
// the members alone.
const UPDATABLE_TEXT_FIELDS = ['name', 'description'];

async function updateWorkspace(req, res) {
  const { workspaceId } = req.params;
  const { user, body } = req;

  try {
    const fields = pick(body, UPDATABLE_TEXT_FIELDS);
    if (Object.values(fields).some((value) => typeof value !== 'string')) {
      return res.status(400).send(ERROR_CODES.INVALID_REQUEST);
    }

    const workspace = await workspaceService.getWorkspace(workspaceId);
    if (!workspace) {
      return res.status(404).send(ERROR_CODES.WORKSPACE_NOT_FOUND);
    }
    // A company admin updates the workspaces of its company, a super admin
    // those of every company.
    if (!permissions.canManageGroup(user, workspace._company)) {
      return res.status(403).send(ERROR_CODES.FORBIDDEN_WORKSPACE_RETRIEVAL);
    }

    const { selectedUsers } = body;
    await workspaceService.updateWorkspace({
      id: workspaceId,
      groupId: workspace._company,
      ...fields,
      _users: (Array.isArray(selectedUsers) ? selectedUsers : []).map(
        (member) => member && member.id
      ),
    });
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

    // A super admin reaches the workspaces of every company, anyone else
    // those of its own company.
    if (!permissions.canAccessGroup(user, workspace._company)) {
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

    // A super admin reaches the workspaces of every company, anyone else
    // those of its own company.
    if (!permissions.canAccessGroup(user, workspace._company)) {
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
