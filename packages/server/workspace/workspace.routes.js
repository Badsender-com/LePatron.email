'use strict';

const express = require('express');
const router = express.Router();

const workspaces = require('./workspace.controller.js');
const { GUARD_ADMIN_OR_GROUP_ADMIN } = require('../account/auth.guard');

router.all('*', GUARD_ADMIN_OR_GROUP_ADMIN);
router.get('', workspaces.list);
router.get('/name/:workspaceName', workspaces.findOneByName);
router.post('', workspaces.create);

module.exports = router;
