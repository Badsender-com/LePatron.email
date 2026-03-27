'use strict';

const jwt = require('jsonwebtoken');
const createError = require('http-errors');
const mongoose = require('mongoose');

const GroupService = require('../group/group.service');
const { Groups } = require('../common/models.common');
const ERROR_CODES = require('../constant/error-codes');

const JWT_EXPIRATION_SECONDS = 10 * 60; // 10 minutes

/**
 * Get CRM Intelligence status for a group
 * @param {string} groupId - The group ID
 * @returns {Promise<Object>} Status object with enabled flag and dashboard count
 */
async function getStatus(groupId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  const isEnabled = group.enableCrmIntelligence === true;
  const isConfigured = Boolean(
    isEnabled &&
    group.metabaseConfig?.siteUrl &&
    group.metabaseConfig?.secretKey
  );
  const dashboardCount = group.metabaseConfig?.dashboards?.length || 0;

  return {
    enabled: isEnabled,
    configured: isConfigured,
    dashboardCount,
  };
}

/**
 * Get list of dashboards for a group
 * @param {string} groupId - The group ID
 * @returns {Promise<Array>} Array of dashboard objects (without sensitive data)
 */
async function getDashboards(groupId) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  if (!group.enableCrmIntelligence) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_NOT_ENABLED);
  }

  const dashboards = group.metabaseConfig?.dashboards || [];

  // Return dashboards sorted by order, without sensitive data
  return dashboards
    .map((dashboard) => ({
      id: dashboard._id,
      metabaseId: dashboard.metabaseId,
      name: dashboard.name,
      description: dashboard.description,
      order: dashboard.order,
    }))
    .sort((a, b) => a.order - b.order);
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

  const { metabaseConfig } = group;
  if (!metabaseConfig?.siteUrl || !metabaseConfig?.secretKey) {
    throw createError(500, ERROR_CODES.CRM_INTELLIGENCE_NOT_CONFIGURED);
  }

  // Find the dashboard
  const dashboard = metabaseConfig.dashboards.find(
    (d) => d._id.toString() === dashboardId
  );
  if (!dashboard) {
    throw createError(404, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  // Build JWT payload
  const payload = {
    resource: { dashboard: dashboard.metabaseId },
    params: dashboard.lockedParams || {},
    exp: Math.round(Date.now() / 1000) + JWT_EXPIRATION_SECONDS,
  };

  // Sign the JWT
  const token = jwt.sign(payload, metabaseConfig.secretKey);

  // Build the embed URL
  const embedUrl = `${metabaseConfig.siteUrl}/embed/dashboard/${token}#bordered=false&titled=true`;

  return {
    embedUrl,
    dashboardName: dashboard.name,
    expiresIn: JWT_EXPIRATION_SECONDS,
  };
}

/**
 * Update CRM Intelligence configuration for a group (Super Admin only)
 * @param {string} groupId - The group ID
 * @param {Object} config - Configuration object
 * @returns {Promise<Object>} Updated configuration status
 */
async function updateConfiguration(groupId, config) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  const updateData = {};

  // Update enable flag if provided
  if (typeof config.enabled === 'boolean') {
    updateData.enableCrmIntelligence = config.enabled;
  }

  // Update Metabase config if provided
  if (config.siteUrl !== undefined) {
    updateData['metabaseConfig.siteUrl'] = config.siteUrl;
  }

  if (config.secretKey !== undefined) {
    updateData['metabaseConfig.secretKey'] = config.secretKey;
  }

  if (config.dashboards !== undefined) {
    // Validate dashboards
    const dashboards = config.dashboards.map((d, index) => ({
      metabaseId: d.metabaseId,
      name: d.name,
      description: d.description || '',
      lockedParams: d.lockedParams || {},
      order: d.order !== undefined ? d.order : index,
    }));
    updateData['metabaseConfig.dashboards'] = dashboards;
  }

  await Groups.updateOne(
    { _id: groupId },
    { $set: updateData }
  );

  return getStatus(groupId);
}

/**
 * Test Metabase connection by verifying the config format
 * Note: We can't actually test the connection without making a request to Metabase
 * This just validates the configuration is present and well-formed
 * @param {string} groupId - The group ID
 * @param {Object} [config] - Optional config to test (uses saved config if not provided)
 * @param {string} [config.siteUrl] - Metabase site URL
 * @param {string} [config.secretKey] - Metabase secret key
 * @returns {Promise<Object>} Connection test result
 */
async function testConnection(groupId, config = null) {
  const group = await GroupService.findById(groupId);
  if (!group) {
    throw createError(404, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Use provided config or fall back to saved config
  const siteUrl = config?.siteUrl ?? group.metabaseConfig?.siteUrl;
  const secretKey = config?.secretKey ?? group.metabaseConfig?.secretKey;

  const hasUrl = Boolean(siteUrl);
  const hasSecret = Boolean(secretKey);

  if (!hasUrl || !hasSecret) {
    return {
      success: false,
      message: 'Missing Metabase URL or secret key',
    };
  }

  // Validate URL format
  try {
    new URL(siteUrl);
  } catch {
    return {
      success: false,
      message: 'Invalid Metabase URL format',
    };
  }

  return {
    success: true,
    message: 'Configuration looks valid',
  };
}

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
  updateConfiguration,
  testConnection,
};
