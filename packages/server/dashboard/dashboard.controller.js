'use strict';

const createError = require('http-errors');

const dashboardService = require('./dashboard.service.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * List dashboards for a group
 * GET /api/dashboards/groups/:groupId
 */
async function listDashboards(req, res) {
  const { groupId } = req.params;

  const dashboards = await dashboardService.listDashboards(groupId);

  res.json({ items: dashboards });
}

/**
 * Get a single dashboard
 * GET /api/dashboards/:dashboardId
 */
async function readDashboard(req, res) {
  const { dashboardId } = req.params;

  const dashboard = await dashboardService.getDashboard(dashboardId);

  res.json(dashboard);
}

/**
 * Create a dashboard
 * POST /api/dashboards/groups/:groupId
 */
async function createDashboard(req, res) {
  const { groupId } = req.params;
  const { name, description, integrationId, providerDashboardId, lockedParams } =
    req.body;

  // Validate required fields
  if (!name) {
    throw createError(400, 'Dashboard name is required', {
      code: ERROR_CODES.INVALID_REQUEST,
    });
  }

  if (!integrationId) {
    throw createError(400, 'Integration ID is required', {
      code: ERROR_CODES.INVALID_REQUEST,
    });
  }

  if (providerDashboardId === undefined || providerDashboardId === null) {
    throw createError(400, 'Provider dashboard ID is required', {
      code: ERROR_CODES.INVALID_REQUEST,
    });
  }

  const dashboard = await dashboardService.createDashboard(groupId, {
    name,
    description,
    integrationId,
    providerDashboardId: parseInt(providerDashboardId, 10),
    lockedParams,
  });

  res.status(201).json(dashboard);
}

/**
 * Update a dashboard
 * PUT /api/dashboards/:dashboardId
 */
async function updateDashboard(req, res) {
  const { dashboardId } = req.params;
  const { name, description, integrationId, providerDashboardId, lockedParams, isActive } =
    req.body;

  const dashboard = await dashboardService.updateDashboard(dashboardId, {
    name,
    description,
    integrationId,
    providerDashboardId:
      providerDashboardId !== undefined
        ? parseInt(providerDashboardId, 10)
        : undefined,
    lockedParams,
    isActive,
  });

  res.json(dashboard);
}

/**
 * Delete a dashboard
 * DELETE /api/dashboards/:dashboardId
 */
async function deleteDashboard(req, res) {
  const { dashboardId } = req.params;

  await dashboardService.deleteDashboard(dashboardId);

  res.status(204).send();
}

/**
 * Reorder dashboards for a group
 * PUT /api/dashboards/groups/:groupId/reorder
 */
async function reorderDashboards(req, res) {
  const { groupId } = req.params;
  const { dashboardIds } = req.body;

  if (!Array.isArray(dashboardIds)) {
    throw createError(400, 'dashboardIds must be an array', {
      code: ERROR_CODES.INVALID_REQUEST,
    });
  }

  const dashboards = await dashboardService.reorderDashboards(
    groupId,
    dashboardIds
  );

  res.json({ items: dashboards });
}

module.exports = {
  listDashboards,
  readDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
};
