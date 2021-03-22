'use strict';

const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const { GUARD_ADMIN, guard } = require('../account/auth.guard.js');
const Roles = require('../account/roles.js');
const users = require('./user.controller.js');

/// ///
// USERS
/// ///

router.all('*', guard([Roles.SUPER_ADMIN, Roles.GROUP_ADMIN]));
router.get('', GUARD_ADMIN, users.list);
router.get('/:userId', users.read);
router.post('', users.create);
router.put('/:userId', users.update);
router.delete('/:userId', users.deactivate);

router.put('/:userId/activate', users.activate);
router.put('/:userId/password', users.setPassword);
router.delete('/:userId/password', users.adminResetPassword);
router.get('/:userId/mailings', users.readMailings);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
