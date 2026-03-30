'use strict';

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { Types } = require('mongoose');

const GroupService = require('../group/group.service');
const { Integrations, Dashboards } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const IntegrationTypes = require('../constant/integration-type');

const JWT_EXPIRATION_SECONDS = 10 * 60; // 10 minutes

/**
 * Get CRM Intelligence status for a group
 * Checks if there are active dashboard integrations and dashboards
 * @param {string} groupId - The group ID
 * @returns {Promise<Object>} Status object with enabled flag and dashboard count
 */
async function getStatus(groupId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Check if CRM Intelligence is enabled at group level
  const isEnabled = group.enableCrmIntelligence === true;

  if (!isEnabled) {
    return {
      enabled: false,
      configured: false,
      dashboardCount: 0,
      integrations: [],
    };
  }

  // Find active dashboard integrations for this group
  const integrations = await Integrations.find({
    _company: Types.ObjectId(groupId),
    type: IntegrationTypes.DASHBOARD,
    isActive: true,
  }).sort({ name: 1 });

  // Count active dashboards for this group
  const dashboardCount = await Dashboards.countDocuments({
    _company: Types.ObjectId(groupId),
    isActive: true,
  });

  return {
    enabled: isEnabled,
    configured: integrations.length > 0 && dashboardCount > 0,
    dashboardCount,
    integrations: integrations.map((i) => ({
      id: i._id,
      name: i.name,
      provider: i.provider,
    })),
  };
}

/**
 * Get list of dashboards for a group (across all integrations)
 * @param {string} groupId - The group ID
 * @returns {Promise<Array>} Array of dashboard objects with integration context
 */
async function getDashboards(groupId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  // Find active dashboards for this group, ordered globally
  const dashboards = await Dashboards.find({
    _company: Types.ObjectId(groupId),
    isActive: true,
  })
    .sort({ order: 1, createdAt: 1 })
    .populate('_integration', 'name provider apiHost')
    .lean();

  return dashboards.map((dashboard) => ({
    id: dashboard._id.toString(),
    integrationId: dashboard._integration?._id.toString(),
    integrationName: dashboard._integration?.name,
    provider: dashboard._integration?.provider,
    providerDashboardId: dashboard.providerDashboardId,
    name: dashboard.name,
    description: dashboard.description,
    order: dashboard.order,
  }));
}

/**
 * Generate a signed embed URL for a Metabase dashboard
 * @param {string} groupId - The group ID
 * @param {string} dashboardId - The dashboard MongoDB ID
 * @returns {Promise<Object>} Object with embedUrl
 */
async function getEmbedUrl(groupId, dashboardId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  // Validate dashboard ID
  if (!Types.ObjectId.isValid(dashboardId)) {
    throw createError(400, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  // Find the dashboard with its integration
  const dashboard = await Dashboards.findOne({
    _id: Types.ObjectId(dashboardId),
    _company: Types.ObjectId(groupId),
    isActive: true,
  }).populate('_integration');

  if (!dashboard) {
    throw createError(404, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  const integration = dashboard._integration;

  if (!integration || !integration.isActive) {
    throw createError(404, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  if (!integration.apiHost || !integration.apiKey) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  // Build JWT payload for Metabase
  const payload = {
    resource: { dashboard: dashboard.providerDashboardId },
    params: dashboard.lockedParams || {},
    exp: Math.round(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
  };

  // Sign the JWT with the integration's secret key
  const token = jwt.sign(payload, integration.apiKey);

  // Build the embed URL
  const embedUrl = `${integration.apiHost}/embed/dashboard/${token}#bordered=false&titled=true`;

  return {
    embedUrl,
    dashboardName: dashboard.name,
    integrationName: integration.name,
    expiresIn: JWT_EXPIRATION_SECONDS,
  };
}

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
};
