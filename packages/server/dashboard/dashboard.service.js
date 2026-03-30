'use strict';

const { Types } = require('mongoose');
const createError = require('http-errors');

const { Dashboards, Integrations } = require('../common/models.common.js');
const ERROR_CODES = require('../constant/error-codes.js');

/**
 * List all dashboards for a group, ordered by 'order' field
 * @param {string} groupId
 * @returns {Promise<Array>}
 */
async function listDashboards(groupId) {
  const dashboards = await Dashboards.find({
    _company: Types.ObjectId(groupId),
  })
    .sort({ order: 1, createdAt: 1 })
    .populate('_integration', 'name provider apiHost')
    .lean();

  return dashboards.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    description: d.description,
    providerDashboardId: d.providerDashboardId,
    order: d.order,
    isActive: d.isActive,
    lockedParams: d.lockedParams,
    integration: d._integration
      ? {
          id: d._integration._id.toString(),
          name: d._integration.name,
          provider: d._integration.provider,
          apiHost: d._integration.apiHost,
        }
      : null,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  }));
}

/**
 * Get a single dashboard by ID
 * @param {string} dashboardId
 * @returns {Promise<Object>}
 */
async function getDashboard(dashboardId) {
  const dashboard = await Dashboards.findById(dashboardId)
    .populate('_integration', 'name provider apiHost')
    .lean();

  if (!dashboard) {
    throw createError(404, 'Dashboard not found', {
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
    });
  }

  return {
    id: dashboard._id.toString(),
    name: dashboard.name,
    description: dashboard.description,
    providerDashboardId: dashboard.providerDashboardId,
    order: dashboard.order,
    isActive: dashboard.isActive,
    lockedParams: dashboard.lockedParams,
    groupId: dashboard._company.toString(),
    integration: dashboard._integration
      ? {
          id: dashboard._integration._id.toString(),
          name: dashboard._integration.name,
          provider: dashboard._integration.provider,
          apiHost: dashboard._integration.apiHost,
        }
      : null,
    createdAt: dashboard.createdAt,
    updatedAt: dashboard.updatedAt,
  };
}

/**
 * Create a new dashboard
 * @param {string} groupId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createDashboard(groupId, data) {
  const { name, description, integrationId, providerDashboardId, lockedParams } =
    data;

  // Validate integration exists and belongs to the same group
  const integration = await Integrations.findOne({
    _id: Types.ObjectId(integrationId),
    _company: Types.ObjectId(groupId),
  });

  if (!integration) {
    throw createError(400, 'Integration not found or does not belong to this group', {
      code: ERROR_CODES.INVALID_INTEGRATION,
    });
  }

  // Get the highest order value to place new dashboard at the end
  const lastDashboard = await Dashboards.findOne({
    _company: Types.ObjectId(groupId),
  })
    .sort({ order: -1 })
    .select('order')
    .lean();

  const nextOrder = lastDashboard ? lastDashboard.order + 1 : 0;

  try {
    const dashboard = await Dashboards.create({
      name,
      description: description || '',
      _company: Types.ObjectId(groupId),
      _integration: Types.ObjectId(integrationId),
      providerDashboardId,
      lockedParams: lockedParams || {},
      order: nextOrder,
      isActive: true,
    });

    return getDashboard(dashboard._id.toString());
  } catch (err) {
    // Handle duplicate key error
    if (err.code === 11000) {
      throw createError(409, 'A dashboard with this ID already exists for this integration', {
        code: ERROR_CODES.DASHBOARD_ALREADY_EXISTS,
      });
    }
    throw err;
  }
}

/**
 * Update a dashboard
 * @param {string} dashboardId
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function updateDashboard(dashboardId, data) {
  const dashboard = await Dashboards.findById(dashboardId);

  if (!dashboard) {
    throw createError(404, 'Dashboard not found', {
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
    });
  }

  const { name, description, integrationId, providerDashboardId, lockedParams, isActive } =
    data;

  // If changing integration, validate it exists and belongs to the same group
  if (integrationId && integrationId !== dashboard._integration.toString()) {
    const integration = await Integrations.findOne({
      _id: Types.ObjectId(integrationId),
      _company: dashboard._company,
    });

    if (!integration) {
      throw createError(400, 'Integration not found or does not belong to this group', {
        code: ERROR_CODES.INVALID_INTEGRATION,
      });
    }

    dashboard._integration = Types.ObjectId(integrationId);
  }

  if (name !== undefined) dashboard.name = name;
  if (description !== undefined) dashboard.description = description;
  if (providerDashboardId !== undefined)
    dashboard.providerDashboardId = providerDashboardId;
  if (lockedParams !== undefined) dashboard.lockedParams = lockedParams;
  if (isActive !== undefined) dashboard.isActive = isActive;

  await dashboard.save();

  return getDashboard(dashboardId);
}

/**
 * Delete a dashboard
 * @param {string} dashboardId
 * @returns {Promise<void>}
 */
async function deleteDashboard(dashboardId) {
  const dashboard = await Dashboards.findById(dashboardId);

  if (!dashboard) {
    throw createError(404, 'Dashboard not found', {
      code: ERROR_CODES.RESOURCE_NOT_FOUND,
    });
  }

  await Dashboards.deleteOne({ _id: dashboard._id });
}

/**
 * Reorder dashboards for a group
 * @param {string} groupId
 * @param {Array<string>} dashboardIds - Array of dashboard IDs in desired order
 * @returns {Promise<Array>}
 */
async function reorderDashboards(groupId, dashboardIds) {
  // Validate all dashboard IDs belong to the group
  const dashboards = await Dashboards.find({
    _id: { $in: dashboardIds.map((id) => Types.ObjectId(id)) },
    _company: Types.ObjectId(groupId),
  });

  if (dashboards.length !== dashboardIds.length) {
    throw createError(400, 'Some dashboards not found or do not belong to this group', {
      code: ERROR_CODES.INVALID_REQUEST,
    });
  }

  // Update order for each dashboard
  const bulkOps = dashboardIds.map((id, index) => ({
    updateOne: {
      filter: { _id: Types.ObjectId(id) },
      update: { $set: { order: index } },
    },
  }));

  await Dashboards.bulkWrite(bulkOps);

  return listDashboards(groupId);
}

/**
 * Get the group ID for a dashboard (for authorization checks)
 * @param {string} dashboardId
 * @returns {Promise<string|null>}
 */
async function getGroupIdForDashboard(dashboardId) {
  const dashboard = await Dashboards.findById(dashboardId)
    .select('_company')
    .lean();

  return dashboard ? dashboard._company.toString() : null;
}

module.exports = {
  listDashboards,
  getDashboard,
  createDashboard,
  updateDashboard,
  deleteDashboard,
  reorderDashboards,
  getGroupIdForDashboard,
};
