'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const crmIntelligence = require('./crm-intelligence.controller.js');

/**
 * CRM Intelligence routes for regular users
 * Integration management routes are in integration.routes.js
 */

// Get CRM Intelligence status for current user's group
router.get('/status', GUARD_USER, crmIntelligence.getStatus);

// Get list of dashboards for current user's group (across all integrations)
router.get('/dashboards', GUARD_USER, crmIntelligence.getDashboards);

// Get signed embed URL for a specific dashboard
// Requires both integrationId and dashboardId
router.get(
  '/embed/:integrationId/:dashboardId',
  GUARD_USER,
  crmIntelligence.getEmbedUrl
);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
