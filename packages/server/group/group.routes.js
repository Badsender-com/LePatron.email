'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_ADMIN_OR_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
} = require('../account/auth.guard.js');
const groups = require('./group.controller.js');

router.get(
  '/:groupId/users',
  GUARD_ADMIN_OR_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
  groups.readUsers
);
router.get('/:groupId/templates', GUARD_ADMIN, groups.readTemplates);
router.get('/:groupId/mailings', GUARD_ADMIN, groups.readMailings);
router.put(
  '/:groupId',
  GUARD_ADMIN_OR_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
  groups.update
);
router.get(
  '/:groupId',
  GUARD_ADMIN_OR_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
  groups.read
);
router.post('', GUARD_ADMIN, groups.create);
router.get('', GUARD_ADMIN, groups.list);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
