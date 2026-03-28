'use strict';

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { Types } = require('mongoose');

const GroupService = require('../group/group.service');
const { Integrations } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const IntegrationTypes = require('../constant/integration-type');

const JWT_EXPIRATION_SECONDS = 10 * 60; // 10 minutes

/**
 * Get CRM Intelligence status for a group
 * Checks if there are active dashboard integrations
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

  const totalDashboardCount = integrations.reduce(
    (sum, integration) => sum + (integration.dashboards?.length || 0),
    0
  );

  return {
    enabled: isEnabled,
    configured: integrations.length > 0 && totalDashboardCount > 0,
    dashboardCount: totalDashboardCount,
    integrations: integrations.map((i) => ({
      id: i._id,
      name: i.name,
      provider: i.provider,
      dashboardCount: i.dashboards?.length || 0,
    })),
  };
}

/**
 * Get list of dashboards for a group (across all integrations)
 * @param {string} groupId - The group ID
 * @returns {Promise<Array>} Array of dashboard objects grouped by integration
 */
async function getDashboards(groupId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  // Find active dashboard integrations for this group
  const integrations = await Integrations.find({
    _company: Types.ObjectId(groupId),
    type: IntegrationTypes.DASHBOARD,
    isActive: true,
  }).sort({ name: 1 });

  // Flatten dashboards with integration context
  const dashboards = [];
  for (const integration of integrations) {
    const integrationDashboards = (integration.dashboards || [])
      .map((dashboard) => ({
        id: dashboard._id,
        integrationId: integration._id,
        integrationName: integration.name,
        provider: integration.provider,
        metabaseId: dashboard.metabaseId,
        name: dashboard.name,
        description: dashboard.description,
        order: dashboard.order,
      }))
      .sort((a, b) => a.order - b.order);

    dashboards.push(...integrationDashboards);
  }

  return dashboards;
}

/**
 * Generate a signed embed URL for a Metabase dashboard
 * @param {string} groupId - The group ID
 * @param {string} integrationId - The integration MongoDB ID
 * @param {string} dashboardId - The dashboard MongoDB ID within the integration
 * @returns {Promise<Object>} Object with embedUrl
 */
async function getEmbedUrl(groupId, integrationId, dashboardId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  // Validate IDs
  if (!Types.ObjectId.isValid(integrationId)) {
    throw createError(400, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }
  if (!Types.ObjectId.isValid(dashboardId)) {
    throw createError(400, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  // Find the integration
  const integration = await Integrations.findOne({
    _id: Types.ObjectId(integrationId),
    _company: Types.ObjectId(groupId),
    type: IntegrationTypes.DASHBOARD,
    isActive: true,
  });

  if (!integration) {
    throw createError(404, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  if (!integration.apiHost || !integration.apiKey) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  // Find the dashboard
  const dashboard = integration.dashboards.find(
    (d) => d._id.toString() === dashboardId
  );
  if (!dashboard) {
    throw createError(404, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  // Build JWT payload for Metabase
  const payload = {
    resource: { dashboard: dashboard.metabaseId },
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

/**
 * Get dashboards for a specific integration
 * @param {string} integrationId - The integration MongoDB ID
 * @returns {Promise<Array>} Array of dashboard objects
 */
async function getIntegrationDashboards(integrationId) {
  if (!Types.ObjectId.isValid(integrationId)) {
    throw createError(400, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  const integration = await Integrations.findById(integrationId);
  if (!integration) {
    throw createError(404, ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  return (integration.dashboards || [])
    .map((dashboard) => ({
      id: dashboard._id,
      metabaseId: dashboard.metabaseId,
      name: dashboard.name,
      description: dashboard.description,
      order: dashboard.order,
    }))
    .sort((a, b) => a.order - b.order);
}

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
  getIntegrationDashboards,
};
