'use strict';

const express = require('express');
const { GUARD_CAN } = require('../account/auth.guard.js');
const { CAPABILITIES } = require('../../shared/access/roles.js');
const feedbacks = require('./mcp-feedback.controller.js');

// The feedbacks are read by the platform's operators only (ADR 0012).
const router = express.Router();

router.get('/', GUARD_CAN(CAPABILITIES.PLATFORM_MANAGE), feedbacks.list);

module.exports = router;
