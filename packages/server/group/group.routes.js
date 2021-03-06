'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_ADMIN, guard } = require('../account/auth.guard.js');
const Roles = require('../account/roles.js');
const groups = require('./group.controller.js');
const { GUARD_CAN_ACCESS_GROUP } = require('./group.guard.js');

router.get(
  '/:groupId/users',
  guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]),
  GUARD_CAN_ACCESS_GROUP,
  groups.readUsers
);
router.get('/:groupId/templates', GUARD_ADMIN, groups.readTemplates);
router.get('/:groupId/mailings', GUARD_ADMIN, groups.readMailings);
router.put(
  '/:groupId',
  guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]),
  GUARD_CAN_ACCESS_GROUP,
  groups.update
);
router.get(
  '/:groupId',
  guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]),
  GUARD_CAN_ACCESS_GROUP,
  groups.read
);
router.post('', GUARD_ADMIN, groups.create);
router.get('', GUARD_ADMIN, groups.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
