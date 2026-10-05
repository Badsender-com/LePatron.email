'use strict';

const express = require('express');

const { GUARD_USER } = require('../account/auth.guard.js');
const { aiRateLimit } = require('../ai-usage/ai-rate-limit.js');
const textGeneration = require('./text-generation.controller.js');

const router = express.Router();

// Any user who can edit the mailing; the controller checks that access. The AI
// rate limit counts the request before it reaches a provider.
router.post(
  '/subject',
  GUARD_USER,
  aiRateLimit(),
  textGeneration.generateSubject
);

module.exports = router;
