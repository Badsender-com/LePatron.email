'use strict';

const express = require('express');
const router = express.Router();

const { GUARD_GROUP_ADMIN, GUARD_USER } = require('../account/auth.guard');
const emailsGroup = require('./emails-group.controller');

router.get('', GUARD_USER, emailsGroup.listEmailsGroups);
router.post('', GUARD_GROUP_ADMIN, emailsGroup.createEmailsGroup);
router.get('/:emailsGroupId', GUARD_USER, emailsGroup.getEmailsGroup);
router.delete(
  '/:emailsGroupId',
  GUARD_GROUP_ADMIN,
  emailsGroup.deleteEmailsGroup
);
router.patch('/:emailsGroupId', GUARD_GROUP_ADMIN, emailsGroup.editEmailsGroup);

module.exports = router;
