'use strict';

const express = require('express');
const { GUARD_GROUP_ADMIN } = require('../account/auth.guard');
const { GUARD_CAN_ACCESS_GROUP } = require('../group/group.guard');

const router = express.Router();
const workspacesController = require('./workspace.controller.js');

router.get(
  '/',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  workspacesController.findByGroupWithUserCount
);
router.get(
  '/folders',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  workspacesController.list
);

router.post(
  '/',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  workspacesController.createWorkspace
);

router.put('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});

router.delete('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});
module.exports = router;
