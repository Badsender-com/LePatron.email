'use strict';

const express = require('express');
const router = express.Router();

const { GUARD_GROUP_ADMIN, GUARD_USER } = require('../account/auth.guard');
const emailGroup = require('./email-group.controller');

router.get('', GUARD_USER, emailGroup.listEmailGroups);
router.post('', GUARD_GROUP_ADMIN, emailGroup.createEmailGroup);
router.get('/:emailGroupId', GUARD_USER, emailGroup.getEmailGroup);
router.delete('/:emailGroupId', GUARD_GROUP_ADMIN, emailGroup.deleteEmailGroup);
router.patch('/:emailGroupId', GUARD_GROUP_ADMIN, emailGroup.editEmailGroup);

module.exports = router;
