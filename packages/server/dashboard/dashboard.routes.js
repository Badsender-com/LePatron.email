'use strict';

const express = require('express');

const router = express.Router();

const dashboards = require('./dashboard.controller.js');

const { GUARD_GROUP_ADMIN } = require('../account/auth.guard.js');

// List dashboards for a group
router.get('/groups/:groupId', GUARD_GROUP_ADMIN, dashboards.listDashboards);

// Create dashboard for a group
router.post('/groups/:groupId', GUARD_GROUP_ADMIN, dashboards.createDashboard);

// Reorder dashboards for a group
router.put(
  '/groups/:groupId/reorder',
  GUARD_GROUP_ADMIN,
  dashboards.reorderDashboards
);

// Read single dashboard
router.get('/:dashboardId', GUARD_GROUP_ADMIN, dashboards.readDashboard);

// Update dashboard
router.put('/:dashboardId', GUARD_GROUP_ADMIN, dashboards.updateDashboard);

// Delete dashboard
router.delete('/:dashboardId', GUARD_GROUP_ADMIN, dashboards.deleteDashboard);

module.exports = router;
