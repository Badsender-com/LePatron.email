'use strict';

const express = require('express');
const router = express.Router();

const folders = require('./folder.controller.js');
router.get('', folders.list);
router.get('/:folderId/has-access', folders.hasAccess);
router.post('', folders.create);
router.get('/:folderId', folders.getFolder);

module.exports = router;
