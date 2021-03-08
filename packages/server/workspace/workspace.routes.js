'use strict';

const express = require('express');
const { GUARD_GROUP_ADMIN } = require('../account/auth.guard');

const router = express.Router();
const workspacesController = require('./workspace.controller.js');
const { GUARD_USER_HAVE_GROUP_ID } = require('../group/group.guard');
const { guard } = require('../account/auth.guard');

router.get(
  '/',
  GUARD_GROUP_ADMIN,
  GUARD_USER_HAVE_GROUP_ID,
  workspacesController.findByGroupWithUserCount
);
router.get(
  '/folders',
  guard(),
  GUARD_USER_HAVE_GROUP_ID,
  workspacesController.list
);

router.post('/', GUARD_GROUP_ADMIN, workspacesController.createWorkspace);

router.put('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});

router.delete('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});
module.exports = router;
