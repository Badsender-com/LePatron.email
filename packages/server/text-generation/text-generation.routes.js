'use strict';

const express = require('express');

const { GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES: C } = require('../../shared/access/roles.js');
const { aiRateLimit } = require('../ai-usage/ai-rate-limit.js');
const textGeneration = require('./text-generation.controller.js');

const router = express.Router();

// Whoever may edit an email's content (ADR 0004): a proposal is written into
// it. The controller checks access to the mailing itself. The AI rate limit
// counts the request before it reaches a provider.
router.post(
  '/subject',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  aiRateLimit(),
  textGeneration.generateSubject
);

router.post(
  '/preheader',
  GUARD_CAN(C.MAILING_EDIT_CONTENT),
  aiRateLimit(),
  textGeneration.generatePreheader
);

module.exports = router;
