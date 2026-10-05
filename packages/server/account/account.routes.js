'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const users = require('../user/user.controller.js');
const logger = require('../utils/logger.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');

const HOUR = 60 * 60 * 1000;

// Public, unauthenticated endpoints: bounded per client address, each with
// its own budget (a login is two calls: profile, then login), and the
// password reset per account too, so nobody can flood an inbox.
const perAddress = () =>
  createRateLimiter({ windowMs: HOUR, max: 120, keyOf: clientIp });
const limitResetPerAccount = createRateLimiter({
  windowMs: HOUR,
  max: 3,
  keyOf: (req) =>
    String(req.params.email || '')
      .trim()
      .toLowerCase(),
});

router.post('/login', perAddress(), users.login);
router.get('/:username', perAddress(), users.getPublicProfile);
router.delete(
  '/:email/password',
  perAddress(),
  limitResetPerAccount,
  users.forgotPassword
);
router.put('/:email/password/:token', users.setPassword);

// catch anything and forward to error handler
router.use((req, res, next) => {
  logger.log(`[account.routes] unmatched path: ${req.path}`);
  next(new createError.NotImplemented());
});

module.exports = router;
