'use strict';

const express = require('express');
const router = express.Router();

const workspaces = require('./workspace.controller.js');
const { GUARD_GROUP_ADMIN } = require('../account/auth.guard');

router.get('', GUARD_GROUP_ADMIN, workspaces.list);

module.exports = router;
