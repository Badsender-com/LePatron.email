'use strict';

const express = require('express');
const router = express.Router();

const workspaces = require('./workspace.controller.js');
const {
  GUARD_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
} = require('../account/auth.guard.js');

router.get('', workspaces.findByGroupIdOfCurrentUser);

router.get('/name/:workspaceName',
  GUARD_GROUP_ADMIN,
  workspaces.findOneByNameInGroup
);

router.post('',
  GUARD_GROUP_ADMIN, GUARD_CAN_MANAGE_GROUP,
  workspaces.createWorkspaceInGroup
);

module.exports = router;
