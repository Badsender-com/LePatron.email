'use strict';

const express = require('express');
const router = express.Router();

const folders = require('./folder.controller.js');
const { GUARD_USER } = require('../account/auth.guard');

router.get('', folders.list);
router.get('/:folderId/has-access', folders.hasAccess);
router.get('/:folderId/has-content', folders.hasContent);
router.post('/:folderId/move', GUARD_USER, folders.move);
router.post('', folders.create);
router.get('/:folderId', folders.getFolder);
router.delete('/:folderId', folders.deleteFolder);
router.patch('/:folderId', GUARD_USER, folders.rename);

module.exports = router;
