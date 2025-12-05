'use strict';

const express = require('express');
const router = express.Router();

const folders = require('./folder.controller.js');
const { GUARD_USER } = require('../account/auth.guard');

router.get('', GUARD_USER, folders.list);
router.get('/:folderId/has-access', GUARD_USER, folders.hasAccess);
router.post('/:folderId/move', GUARD_USER, folders.move);
router.post('', GUARD_USER, folders.create);
router.get('/:folderId', GUARD_USER, folders.getFolder);
router.delete('/:folderId', GUARD_USER, folders.deleteFolder);
router.patch('/:folderId', GUARD_USER, folders.rename);

module.exports = router;
