'use strict';

const express = require('express');
const createError = require('http-errors');

const { GUARD_USER } = require('../account/auth.guard.js');
const textgen = require('./textgen.controller.js');

const router = express.Router();

// Editor-facing endpoints: standard authenticated users (NOT the admin-only
// /api/ai-skills router — see docs/mosaico-for-agents.md §9).
router.post('/textgen/block', GUARD_USER, textgen.generateBlockText);

router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
