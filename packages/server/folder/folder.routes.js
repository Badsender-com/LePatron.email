'use strict';

const express = require('express');
const router = express.Router();

const folders = require('./folder.controller.js');
const { GUARD_USER, GUARD_CAN } = require('../account/auth.guard');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');

router.get('', GUARD_USER, folders.list);
router.get('/:folderId/children', GUARD_USER, folders.listChildren);
router.get('/:folderId/has-access', GUARD_USER, folders.hasAccess);
router.post('/:folderId/move', GUARD_CAN(C.FOLDER_MANAGE), folders.move);
router.post('', GUARD_CAN(C.FOLDER_MANAGE), folders.create);
router.get('/:folderId', GUARD_USER, folders.getFolder);
// Deleting a folder deletes the emails it holds.
router.delete('/:folderId', GUARD_CAN(C.FOLDER_DELETE), folders.deleteFolder);
router.patch('/:folderId', GUARD_CAN(C.FOLDER_MANAGE), folders.rename);

module.exports = router;
