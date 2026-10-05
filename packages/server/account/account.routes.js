'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const users = require('../user/user.controller.js');
const logger = require('../utils/logger.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');

const HOUR = 60 * 60 * 1000;

// Public, unauthenticated endpoints: bounded per address and, for the
// password reset, per account, so nobody can flood an inbox or lock an
// account out by asking again and again.
const limitPerAddress = createRateLimiter({
  windowMs: HOUR,
  max: 120,
  keyOf: clientIp,
});
const limitResetPerAccount = createRateLimiter({
  windowMs: HOUR,
  max: 3,
  keyOf: (req) => String(req.params.email || '').toLowerCase(),
});

router.post('/login', limitPerAddress, users.login);
router.get('/:username', limitPerAddress, users.getPublicProfile);
router.delete(
  '/:email/password',
  limitPerAddress,
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
