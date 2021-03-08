'use strict';

const express = require('express');
const { guard, GUARD_GROUP_ADMIN } = require('../account/auth.guard');

const router = express.Router();
const workspacesController = require('./workspace.controller.js');

router.get('/', guard(), workspacesController.list);

router.get('/:workspaceId', guard(), workspacesController.getWorkspace);

router.post('/', GUARD_GROUP_ADMIN, workspacesController.createWorkspace);

module.exports = router;
