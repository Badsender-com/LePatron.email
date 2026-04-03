'use strict';

const createError = require('http-errors');
const asyncHandler = require('express-async-handler');

const dashboardService = require('./dashboard.service.js');
const groupService = require('../group/group.service.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * Sanitize lockedParams to only allow flat key/value pairs with safe types.
 * Prevents injection of arbitrary objects into Metabase JWT payload.
 */
function sanitizeLockedParams(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params)) {
    return {};
  }
  const sanitized = {};
  for (const [key, value] of Object.entries(params)) {
    if (
      typeof key === 'string' &&
      (typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean')
    ) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Check if user is authorized to access a dashboard
 * @param {Object} user - Current user
 * @param {string} dashboardId - Dashboard ID to check
 * @returns {Object} Dashboard if authorized
 */
async function getDashboardWithAuthCheck(user, dashboardId) {
  const dashboard = await dashboardService.getDashboard(dashboardId);
  await groupService.checkIfUserIsAuthorizedToAccessGroup({
    user,
    groupId: dashboard.groupId,
  });
  return dashboard;
}

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
  const { user } = req;

  const dashboard = await getDashboardWithAuthCheck(user, dashboardId);

  res.json(dashboard);
}

/**
 * Create a dashboard
 * POST /api/dashboards/groups/:groupId
 */
async function createDashboard(req, res) {
  const { groupId } = req.params;
  const {
    name,
    description,
    integrationId,
    providerDashboardId,
    lockedParams,
  } = req.body;

  // Validate required fields
  if (!name) {
    throw createError(400, ERROR_CODES.DASHBOARD_NAME_REQUIRED);
  }

  if (!integrationId) {
    throw createError(400, ERROR_CODES.DASHBOARD_INTEGRATION_REQUIRED);
  }

  if (providerDashboardId === undefined || providerDashboardId === null) {
    throw createError(400, ERROR_CODES.DASHBOARD_ID_REQUIRED);
  }

  const sanitizedLockedParams = sanitizeLockedParams(lockedParams);

  const dashboard = await dashboardService.createDashboard(groupId, {
    name,
    description,
    integrationId,
    providerDashboardId: parseInt(providerDashboardId, 10),
    lockedParams: sanitizedLockedParams,
  });

  res.status(201).json(dashboard);
}

/**
 * Update a dashboard
 * PUT /api/dashboards/:dashboardId
 */
async function updateDashboard(req, res) {
  const { dashboardId } = req.params;
  const { user } = req;
  const {
    name,
    description,
    integrationId,
    providerDashboardId,
    lockedParams,
    isActive,
  } = req.body;

  // Check authorization before update
  await getDashboardWithAuthCheck(user, dashboardId);

  const dashboard = await dashboardService.updateDashboard(dashboardId, {
    name,
    description,
    integrationId,
    providerDashboardId:
      providerDashboardId !== undefined
        ? parseInt(providerDashboardId, 10)
        : undefined,
    lockedParams:
      lockedParams !== undefined
        ? sanitizeLockedParams(lockedParams)
        : undefined,
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
  const { user } = req;

  // Check authorization before delete
  await getDashboardWithAuthCheck(user, dashboardId);

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
    throw createError(400, ERROR_CODES.INVALID_REQUEST);
  }

  const dashboards = await dashboardService.reorderDashboards(
    groupId,
    dashboardIds
  );

  res.json({ items: dashboards });
}

module.exports = {
  listDashboards: asyncHandler(listDashboards),
  readDashboard: asyncHandler(readDashboard),
  createDashboard: asyncHandler(createDashboard),
  updateDashboard: asyncHandler(updateDashboard),
  deleteDashboard: asyncHandler(deleteDashboard),
  reorderDashboards: asyncHandler(reorderDashboards),
};
