'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const validator = require('validator');

const users = require('../user/user.controller.js');
const twoFactor = require('../two-factor/two-factor.controller.js');
const pendingStep = require('../two-factor/pending-step.js');
const {
  CODE_ATTEMPTS_PER_HOUR_PER_ACCOUNT,
} = require('../two-factor/two-factor.constants.js');
const logger = require('../utils/logger.js');
const { normalizeString } = require('../utils/model.js');
const { createRateLimiter, clientIp } = require('../utils/rate-limit.js');

const HOUR = 60 * 60 * 1000;

// Public, unauthenticated endpoints: bounded per client address, each with
// its own budget, and the password reset per account too, so nobody can flood
// an inbox. A whole team behind one address signs in every morning, so the
// login counts the failed attempts only, and the profile (the email step of
// every sign-in, which tells nothing but how to sign in) gets a large budget.
const perAddress = (options) =>
  createRateLimiter({ windowMs: HOUR, max: 120, keyOf: clientIp, ...options });
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

router.post('/login', perAddress({ refundSuccess: true }), users.login);

// The step after a right password (ADR 0008): bounded per address and per
// account apart from the password, on top of the five wrong codes that end
// the step.
const codeStep = [
  perAddress({ refundSuccess: true }),
  createRateLimiter({
    windowMs: HOUR,
    max: CODE_ATTEMPTS_PER_HOUR_PER_ACCOUNT,
    keyOf: pendingStep.userIdOf,
    refundSuccess: true,
  }),
];
router.post('/login/two-factor', ...codeStep, twoFactor.verify);
router.post('/login/two-factor/setup', ...codeStep, twoFactor.startSetup);
router.post(
  '/login/two-factor/setup/confirm',
  ...codeStep,
  twoFactor.confirmSetup
);
router.post(
  '/login/two-factor/email-code',
  ...codeStep,
  twoFactor.sendEmailCode
);
router.get('/:username', perAddress({ max: 1000 }), users.getPublicProfile);
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
