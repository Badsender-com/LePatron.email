'use strict';

const express = require('express');
const { guard, GUARD_GROUP_ADMIN } = require('../account/auth.guard');

const router = express.Router();

const workspacesController = require('./workspace.controller.js');

router.get('/', guard(), workspacesController.listWorkspace);

router.get('/:workspaceId/has-access', guard(), workspacesController.hasAccess);

router.get('/:workspaceId', guard(), workspacesController.getWorkspace);

router.post('/', GUARD_GROUP_ADMIN, workspacesController.createWorkspace);

router.put(
  '/:workspaceId',
  guard(GUARD_GROUP_ADMIN),
  workspacesController.updateWorkspace
);

router.delete(
  '/:workspaceId',
  GUARD_GROUP_ADMIN,
  workspacesController.deleteWorkspace
);
module.exports = router;
