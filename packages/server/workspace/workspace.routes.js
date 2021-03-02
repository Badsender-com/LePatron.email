'use strict';

const express = require('express');
const router = express.Router();

const workspaces = require('./workspace.controller.js');
const { GUARD_GROUP_ADMIN } = require('../account/auth.guard');

router.get('', GUARD_GROUP_ADMIN, workspaces.list);
router.get('/name/:workspaceName', workspaces.findByName);
router.post('', workspaces.create);

module.exports = router;
