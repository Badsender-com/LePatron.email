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
 * @apiSuccess {Boolean} configured Whether there are active dashboard integrations
 * @apiSuccess {Number} dashboardCount Number of configured dashboards
 * @apiSuccess {Object[]} integrations List of active dashboard integrations
 */
const getStatus = asyncHandler(async (req, res) => {
  const { user } = req;

  if (!user.group?.id) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
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
 * @apiSuccess {Object[]} dashboards List of dashboards across all integrations
 * @apiSuccess {String} dashboards.id Dashboard MongoDB ID
 * @apiSuccess {String} dashboards.integrationId Integration MongoDB ID
 * @apiSuccess {String} dashboards.integrationName Integration name
 * @apiSuccess {String} dashboards.provider Provider type (metabase, etc.)
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
 * @apiSuccess {String} integrationName Integration name
 * @apiSuccess {Number} expiresIn Token expiration in seconds
 */
const getEmbedUrl = asyncHandler(async (req, res) => {
  const { user } = req;
  const { dashboardId } = req.params;

  if (!user.group?.id) {
    throw createError(400, ERROR_CODES.GROUP_NOT_FOUND);
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

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
};
