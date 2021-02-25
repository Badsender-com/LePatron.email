'use strict';

const express = require('express');
const router = express.Router();

const workspaces = require('./workspace.controller.js');
router.get('', workspaces.list);

module.exports = router;
