'use strict';

const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const {
  GUARD_ADMIN,
  GUARD_GROUP_ADMIN,
  GUARD_USER,
  guard,
} = require('../account/auth.guard.js');
const users = require('./user.controller.js');

/// ///
// USERS
/// ///
router.get('/me/storage/:key', GUARD_USER, users.getPersistedLocalStorageKey);
router.put(
  '/me/storage/:key',
  GUARD_USER,
  users.updatePersistedLocalStorageKey
);

// Endpoint for getting the current user's details (any authenticated user)
router.get('/current-user', guard(), users.getCurrentUser);

// Place endpoints protected by admin role below, else above
router.all('*', GUARD_GROUP_ADMIN);

router.get('', GUARD_ADMIN, users.list);
router.get('/:userId', users.read);
router.post('', users.create);
router.put('/:userId', users.update);
router.delete('/:userId', users.deactivate);

router.put('/:userId/activate', users.activate);
router.delete('/:userId/password', users.adminResetPassword);
router.get('/:userId/mailings', users.readMailings);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
