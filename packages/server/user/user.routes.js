'use strict';

const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_ADMIN_OR_GROUP_ADMIN,
  GUARD_CAN_MANAGE_GROUP,
} = require('../account/auth.guard.js');
const users = require('./user.controller.js');

/// ///
// USERS
/// ///

router.all('*', GUARD_ADMIN_OR_GROUP_ADMIN);
router.put('/:userId/activate', users.activate);
router.put('/:userId/password', users.setPassword);
router.delete('/:userId/password', users.adminResetPassword);
router.get('/:userId/mailings', users.readMailings);
router.delete('/:userId', users.deactivate);
router.put('/:userId', users.update);
router.get('/:userId', users.read);
router.post('', users.create);
router.get('', GUARD_ADMIN, users.list);
router.get('/group/:groupId', GUARD_CAN_MANAGE_GROUP, users.getByGroupId);

// catch anything and forward to error handler
router.use((req, res, next) => {
  console.log(req.path);
  next(new createError.NotImplemented());
});

module.exports = router;
