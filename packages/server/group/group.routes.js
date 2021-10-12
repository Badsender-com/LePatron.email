'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
  guard,
  GUARD_USER,
} = require('../account/auth.guard.js');
const Roles = require('../account/roles.js');
const groups = require('./group.controller.js');
const { GUARD_CAN_ACCESS_GROUP } = require('./group.guard.js');

router.get('/', GUARD_ADMIN, groups.list);
router.post('', GUARD_ADMIN, groups.create);
router.delete('/:groupId', GUARD_ADMIN, groups.deleteGroup);
router.post('/seed-groups', GUARD_ADMIN, groups.seedGroups);

// guard() will check if the user is logged
router.get('/:groupId', guard(), GUARD_CAN_ACCESS_GROUP, groups.read);

router.put(
  '/:groupId',
  guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]),
  GUARD_CAN_ACCESS_GROUP,
  groups.update
);

router.get(
  '/:groupId/users',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readUsers
);

router.get(
  '/:groupId/templates',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readTemplates
);

router.get(
  '/:groupId/workspaces',
  GUARD_GROUP_ADMIN, // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readWorkspaces
);

router.get(
  '/:groupId/email-groups',
  GUARD_USER, // guard() will check if the user is logged
  groups.readEmailGroups
);

router.get(
  '/:groupId/mailings',
  guard(), // guard() will check if the user is logged
  GUARD_CAN_ACCESS_GROUP,
  groups.readMailings
);

router.get(
  '/:groupId/profiles',
  guard(), // guard() will check if the user is logged
  GUARD_ADMIN,
  groups.readProfiles
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
