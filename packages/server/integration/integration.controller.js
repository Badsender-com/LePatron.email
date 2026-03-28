'use strict';

const asyncHandler = require('express-async-handler');
const integrationService = require('./integration.service');
const groupService = require('../group/group.service');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');

module.exports = {
  createIntegration: asyncHandler(createIntegration),
  updateIntegration: asyncHandler(updateIntegration),
  deleteIntegration: asyncHandler(deleteIntegration),
  readIntegration: asyncHandler(readIntegration),
  listIntegrations: asyncHandler(listIntegrations),
  validateCredentials: asyncHandler(validateCredentials),
  listProviders: asyncHandler(listProviders),
};

/**
 * @api {get} /integrations/providers List available providers
 * @apiPermission user
 * @apiName ListProviders
 * @apiGroup Integrations
 */
async function listProviders(req, res) {
  res.json({
    types: Object.values(IntegrationTypes),
    providers: Object.values(IntegrationProviders),
  });
}

/**
 * @api {get} /integrations/groups/:groupId List integrations for a group
 * @apiPermission groupAdmin
 * @apiName ListIntegrations
 * @apiGroup Integrations
 *
 * @apiParam {String} groupId Group ID
 * @apiQuery {String} [type] Filter by integration type
 */
async function listIntegrations(req, res) {
  const { user, params, query } = req;
  const { groupId } = params;
  const { type } = query;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  let integrations;
  if (type) {
    integrations = await integrationService.findByGroupAndType({
      groupId,
      type,
    });
  } else {
    integrations = await integrationService.findAllByGroup({ groupId });
  }

  // Sanitize: never return the actual API keys
  const sanitized = integrations.map(sanitizeIntegration);

  res.json({ items: sanitized });
}

/**
 * @api {post} /integrations/groups/:groupId Create integration
 * @apiPermission groupAdmin
 * @apiName CreateIntegration
 * @apiGroup Integrations
 */
async function createIntegration(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;
  const { name, type, provider, apiKey, apiHost, config, dashboards } = body;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const integration = await integrationService.createIntegration({
    name,
    type,
    provider,
    apiKey,
    apiHost,
    config,
    dashboards,
    _company: groupId,
  });

  res.status(201).json(sanitizeIntegration(integration));
}

/**
 * @api {get} /integrations/:integrationId Get integration details
 * @apiPermission groupAdmin
 * @apiName ReadIntegration
 * @apiGroup Integrations
 */
async function readIntegration(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  const integration =
    await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
      user,
      integrationId,
    });

  res.json(sanitizeIntegration(integration));
}

/**
 * @api {put} /integrations/:integrationId Update integration
 * @apiPermission groupAdmin
 * @apiName UpdateIntegration
 * @apiGroup Integrations
 */
async function updateIntegration(req, res) {
  const { user, params, body } = req;
  const { integrationId } = params;
  const { name, type, provider, apiKey, apiHost, config, dashboards, isActive } =
    body;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  const integration = await integrationService.updateIntegration({
    integrationId,
    name,
    type,
    provider,
    apiKey,
    apiHost,
    config,
    dashboards,
    isActive,
  });

  res.json(sanitizeIntegration(integration));
}

/**
 * @api {delete} /integrations/:integrationId Delete integration
 * @apiPermission groupAdmin
 * @apiName DeleteIntegration
 * @apiGroup Integrations
 */
async function deleteIntegration(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  await integrationService.deleteIntegration({ integrationId });

  res.json({ success: true });
}

/**
 * @api {post} /integrations/:integrationId/validate Validate integration credentials
 * @apiPermission groupAdmin
 * @apiName ValidateIntegration
 * @apiGroup Integrations
 */
async function validateCredentials(req, res) {
  const { user, params, body } = req;
  const { integrationId } = params;
  const { apiKey, apiHost } = body;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  const isValid = await integrationService.validateCredentials({
    integrationId,
    apiKey,
    apiHost,
  });

  res.json({ valid: isValid });
}

/**
 * Sanitize integration object - never expose API keys
 */
function sanitizeIntegration(integration) {
  const obj = integration.toObject
    ? integration.toObject()
    : { ...integration };
  return {
    ...obj,
    apiKey: obj.apiKey ? '••••••••' : null,
  };
}
