'use strict';

const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const { GUARD_ADMIN, GUARD_GROUP_ADMIN, guard } = require('../account/auth.guard.js');
const Roles = require('../account/roles.js');
const { GUARD_CAN_ACCESS_GROUP } = require('../group/group.guard.js');
const users = require('./user.controller.js');

/// ///
// USERS
/// ///

router.all('*',
  guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]),
  GUARD_CAN_ACCESS_GROUP
);
router.put('/:userId/activate', users.activate);
router.put('/:userId/password', users.setPassword);
router.delete('/:userId/password', users.adminResetPassword);
router.get('/:userId/mailings', users.readMailings);
router.delete('/:userId', users.deactivate);
router.put('/:userId', users.update);
router.get('/:userId', users.read);
router.post('', users.create);
router.get('', GUARD_ADMIN, users.list);
router.get('/group/:groupId',
  GUARD_GROUP_ADMIN,
  GUARD_CAN_ACCESS_GROUP,
  users.getByGroupId
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
