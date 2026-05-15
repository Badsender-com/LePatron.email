'use strict';

const asyncHandler = require('express-async-handler');

const crmIntelligenceService = require('./crm-intelligence.service');

/**
 * @api {get} /crm-intelligence/status Get CRM Intelligence status
 * @apiName GetCrmIntelligenceStatus
 * @apiGroup CrmIntelligence
 * @apiPermission user
 */
const getStatus = asyncHandler(async (req, res) => {
  const status = await crmIntelligenceService.getStatus(
    req.user.group.id,
    req.crmGroup
  );
  res.json(status);
});

/**
 * @api {get} /crm-intelligence/dashboards Get available dashboards
 * @apiName GetCrmIntelligenceDashboards
 * @apiGroup CrmIntelligence
 * @apiPermission user
 */
const getDashboards = asyncHandler(async (req, res) => {
  const dashboards = await crmIntelligenceService.getDashboards(
    req.user.group.id,
    req.crmGroup
  );
  res.json(dashboards);
});

/**
 * @api {get} /crm-intelligence/embed/:dashboardId Get embed URL for a dashboard
 * @apiName GetCrmIntelligenceEmbedUrl
 * @apiGroup CrmIntelligence
 * @apiPermission user
 */
const getEmbedUrl = asyncHandler(async (req, res) => {
  const result = await crmIntelligenceService.getEmbedUrl(
    req.user.group.id,
    req.params.dashboardId,
    req.crmGroup
  );
  res.json(result);
});

module.exports = {
  getStatus,
  getDashboards,
  getEmbedUrl,
};
