'use strict';

const express = require('express');
const { guard, GUARD_GROUP_ADMIN } = require('../account/auth.guard');

const router = express.Router();
const workspacesController = require('./workspace.controller.js');

router.get('/', guard(), workspacesController.list);

router.post('/', GUARD_GROUP_ADMIN, workspacesController.createWorkspace);

router.put('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});

router.delete('/:workspaceId', GUARD_GROUP_ADMIN, (req, res, _next) => {
  return res.end('Endpoint workspace');
});

module.exports = router;
