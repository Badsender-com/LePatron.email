'use strict';

const express = require('express');
const createError = require('http-errors');

const router = express.Router();

const { GUARD_USER } = require('../account/auth.guard.js');
const { guardCrmIntelligence } = require('./crm-intelligence.guard.js');
const crmIntelligence = require('./crm-intelligence.controller.js');

/**
 * CRM Intelligence routes for regular users
 * Integration management routes are in integration.routes.js
 */

// All routes require authenticated user + CRM group context
router.use(GUARD_USER, guardCrmIntelligence);

// Get CRM Intelligence status for current user's group
router.get('/status', crmIntelligence.getStatus);

// Get list of dashboards for current user's group (across all integrations)
router.get('/dashboards', crmIntelligence.getDashboards);

// Get signed embed URL for a specific dashboard
router.get('/embed/:dashboardId', crmIntelligence.getEmbedUrl);

// catch anything and forward to error handler
router.use((req, res, next) => {
  next(new createError.NotImplemented());
});

module.exports = router;
