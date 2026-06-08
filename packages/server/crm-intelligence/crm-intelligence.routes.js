'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const {
  guardCrmIntelligence,
  guardCrmIntelligenceProbe,
} = require('./crm-intelligence.guard.js');
const crmIntelligence = require('./crm-intelligence.controller.js');

/**
 * CRM Intelligence routes for regular users
 * Integration management routes are in integration.routes.js
 */

// /status is a probe endpoint — it returns { enabled: false } when the module
// is off, so the UI can decide whether to render the marketing page. Use the
// non-enforcing guard so we don't 403 on probe.
router.get(
  '/status',
  GUARD_USER,
  guardCrmIntelligenceProbe,
  crmIntelligence.getStatus
);

// All routes below enforce the enableCrmIntelligence flag at the middleware
// level. Future routes added here are protected by default — no need to
// re-check the flag inside each service function.
router.use(GUARD_USER, guardCrmIntelligence);

// Get list of dashboards for current user's group (across all integrations)
router.get('/dashboards', crmIntelligence.getDashboards);

// Get signed embed URL for a specific dashboard
router.get('/embed/:dashboardId', crmIntelligence.getEmbedUrl);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
