'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const validator = require('validator');

const users = require('../user/user.controller.js');
const logger = require('../utils/logger.js');
const { normalizeString } = require('../utils/model.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');

const HOUR = 60 * 60 * 1000;

// Public, unauthenticated endpoints: bounded per client address, each with
// its own budget (a login is two calls: profile, then login), and the
// password reset per account too, so nobody can flood an inbox.
const perAddress = () =>
  createRateLimiter({ windowMs: HOUR, max: 120, keyOf: clientIp });
// Keyed as the account stores its email, so no spelling of one address
// gets a budget of its own.
const limitResetPerAccount = createRateLimiter({
  windowMs: HOUR,
  max: 3,
  keyOf: (req) => normalizeString(req.params.email),
});
function requireEmailParam(req, res, next) {
  if (!validator.isEmail(normalizeString(req.params.email))) {
    return next(new createError.BadRequest());
  }
  next();
}

router.post('/login', perAddress(), users.login);
router.get('/:username', perAddress(), users.getPublicProfile);
router.delete(
  '/:email/password',
  perAddress(),
  requireEmailParam,
  limitResetPerAccount,
  users.forgotPassword
);
router.put('/:email/password/:token', perAddress(), users.setPassword);

// catch anything and forward to error handler
router.use((req, res, next) => {
  logger.log(`[account.routes] unmatched path: ${req.path}`);
  next(new createError.NotImplemented());
});

module.exports = router;
