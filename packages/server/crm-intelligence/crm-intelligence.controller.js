'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');

const crmIntelligenceService = require('./crm-intelligence.service');
const ERROR_CODES = require('../constant/error-codes');

/**
 * @api {get} /crm-intelligence/status Get CRM Intelligence status
 * @apiName GetCrmIntelligenceStatus
 * @apiGroup CrmIntelligence
 * @apiPermission user
 *
 * @apiSuccess {Boolean} enabled Whether CRM Intelligence is enabled for the group
 * @apiSuccess {Boolean} configured Whether Metabase is properly configured
 * @apiSuccess {Number} dashboardCount Number of configured dashboards
 */
const getStatus = asyncHandler(async (req, res) => {
  const { user } = req;

  if (!user.group?.id) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Check user access to CRM Intelligence
  if (user.hasCrmIntelligenceAccess === false) {
    return res.json({
      enabled: false,
      configured: false,
      dashboardCount: 0,
      accessDenied: true,
    });
  }

  const status = await crmIntelligenceService.getStatus(user.group.id);
  res.json(status);
});

/**
 * @api {get} /crm-intelligence/dashboards Get available dashboards
 * @apiName GetCrmIntelligenceDashboards
 * @apiGroup CrmIntelligence
 * @apiPermission user
 *
 * @apiSuccess {Object[]} dashboards List of dashboards
 * @apiSuccess {String} dashboards.id Dashboard MongoDB ID
 * @apiSuccess {Number} dashboards.metabaseId Metabase dashboard ID
 * @apiSuccess {String} dashboards.name Dashboard name
 * @apiSuccess {String} dashboards.description Dashboard description
 * @apiSuccess {Number} dashboards.order Display order
 */
const getDashboards = asyncHandler(async (req, res) => {
  const { user } = req;

  if (!user.group?.id) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Check user access to CRM Intelligence
  if (user.hasCrmIntelligenceAccess === false) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_ACCESS_DENIED);
  }

  const dashboards = await crmIntelligenceService.getDashboards(user.group.id);
  res.json(dashboards);
});

/**
 * @api {get} /crm-intelligence/embed/:dashboardId Get embed URL for a dashboard
 * @apiName GetCrmIntelligenceEmbedUrl
 * @apiGroup CrmIntelligence
 * @apiPermission user
 *
 * @apiParam {String} dashboardId Dashboard MongoDB ID
 *
 * @apiSuccess {String} embedUrl Signed Metabase embed URL
 * @apiSuccess {String} dashboardName Dashboard name
 * @apiSuccess {Number} expiresIn Token expiration in seconds
 */
const getEmbedUrl = asyncHandler(async (req, res) => {
  const { user } = req;
  const { dashboardId } = req.params;

  if (!user.group?.id) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Check user access to CRM Intelligence
  if (user.hasCrmIntelligenceAccess === false) {
    throw createError(403, ERROR_CODES.CRM_INTELLIGENCE_ACCESS_DENIED);
  }

  if (!dashboardId) {
    throw createError(400, ERROR_CODES.DASHBOARD_NOT_FOUND);
  }

  const result = await crmIntelligenceService.getEmbedUrl(
    user.group.id,
    dashboardId
  );
  res.json(result);
});

/**
 * @api {put} /groups/:groupId/crm-intelligence Update CRM Intelligence configuration
 * @apiName UpdateCrmIntelligenceConfig
 * @apiGroup CrmIntelligence
 * @apiPermission admin
 *
 * @apiParam {String} groupId Group ID
 * @apiBody {Boolean} [enabled] Enable/disable CRM Intelligence
 * @apiBody {String} [siteUrl] Metabase site URL
 * @apiBody {String} [secretKey] Metabase embedding secret key
 * @apiBody {Object[]} [dashboards] Dashboard configurations
 *
 * @apiSuccess {Boolean} enabled Whether CRM Intelligence is enabled
 * @apiSuccess {Boolean} configured Whether Metabase is properly configured
 * @apiSuccess {Number} dashboardCount Number of configured dashboards
 */
const updateConfiguration = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const config = req.body;

  if (!groupId) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
  }

  const result = await crmIntelligenceService.updateConfiguration(
    groupId,
    config
  );
  res.json(result);
});

/**
 * @api {post} /groups/:groupId/crm-intelligence/test Test Metabase connection
 * @apiName TestCrmIntelligenceConnection
 * @apiGroup CrmIntelligence
 * @apiPermission admin
 *
 * @apiParam {String} groupId Group ID
 * @apiBody {String} [siteUrl] Metabase URL to test (optional, uses saved if not provided)
 * @apiBody {String} [secretKey] Secret key to test (optional, uses saved if not provided)
 *
 * @apiSuccess {Boolean} success Whether the connection test succeeded
 * @apiSuccess {String} message Result message
 */
const testConnection = asyncHandler(async (req, res) => {
  const { groupId } = req.params;
  const { siteUrl, secretKey } = req.body;

  if (!groupId) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
  }

  // Pass config from body if provided (allows testing before saving)
  const config = siteUrl || secretKey ? { siteUrl, secretKey } : null;
  const result = await crmIntelligenceService.testConnection(groupId, config);
  res.json(result);
});

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
  updateConfiguration,
  testConnection,
};
