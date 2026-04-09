'use strict';

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const { Types } = require('mongoose');

const DashboardService = require('../dashboard/dashboard.service');
const { Integrations, Dashboards } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');
const IntegrationTypes = require('../constant/integration-type');

const JWT_EXPIRATION_SECONDS = 10 * 60; // 10 minutes

/**
 * Get CRM Intelligence status for a group
 * @param {string} groupId - The group ID
 * @param {Object} group - Pre-loaded group (from middleware)
 * @returns {Promise<Object>} Status object with enabled flag and dashboard count
 */
async function getStatus(groupId, group) {
  const isEnabled = group.enableCrmIntelligence === true;

  if (!isEnabled) {
    return {
      enabled: false,
      configured: false,
      dashboardCount: 0,
      integrations: [],
    };
  }

  const [integrations, dashboardCount] = await Promise.all([
    Integrations.find({
      _company: Types.ObjectId(groupId),
      type: IntegrationTypes.DASHBOARD,
      isActive: true,
    }).sort({ name: 1 }),
    Dashboards.countDocuments({
      _company: Types.ObjectId(groupId),
      isActive: true,
    }),
  ]);

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
 * @param {Object} group - Pre-loaded group (from middleware)
 * @returns {Promise<Array>} Array of dashboard objects with integration context
 */
async function getDashboards(groupId, group) {
  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  return DashboardService.listDashboards(groupId, { activeOnly: true });
}

/**
 * Generate a signed embed URL for a Metabase dashboard
 * @param {string} groupId - The group ID
 * @param {string} dashboardId - The dashboard MongoDB ID
 * @param {Object} group - Pre-loaded group (from middleware)
 * @returns {Promise<Object>} Object with embedUrl
 */
async function getEmbedUrl(groupId, dashboardId, group) {
  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  if (!Types.ObjectId.isValid(dashboardId)) {
    throw createError(400, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

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

  const apiKey = integration.apiKey;
  if (!apiKey || apiKey.length < 10) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  const payload = {
    resource: { dashboard: dashboard.providerDashboardId },
    params: dashboard.lockedParams || {},
    exp: Math.round(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
  };

  let token;
  try {
    token = jwt.sign(payload, apiKey, { algorithm: 'HS256' });
  } catch (err) {
    throw createError(500, ERROR_CODES.EMBED_TOKEN_SIGN_FAILED);
  }

  const baseUrl = integration.apiHost.replace(/\/+$/, '');
  const embedUrl = `${baseUrl}/embed/dashboard/${token}#bordered=false&titled=true`;

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
