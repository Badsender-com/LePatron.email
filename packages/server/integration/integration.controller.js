'use strict';

const asyncHandler = require('express-async-handler');
const pick = require('lodash').pick;
const integrationService = require('./integration.service');
const groupService = require('../group/group.service');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const logger = require('../utils/logger.js');

const CREATE_FIELDS = [
  'name',
  'type',
  'provider',
  'apiKey',
  'apiHost',
  'productId',
  'config',
];
const UPDATE_FIELDS = [...CREATE_FIELDS, 'isActive'];

module.exports = {
  createIntegration: asyncHandler(createIntegration),
  updateIntegration: asyncHandler(updateIntegration),
  deleteIntegration: asyncHandler(deleteIntegration),
  getIntegration: asyncHandler(getIntegration),
  listIntegrations: asyncHandler(listIntegrations),
  validateCredentials: asyncHandler(validateCredentials),
  listProviders: asyncHandler(listProviders),
  getModels: asyncHandler(getModels),
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

  res.json({ items: integrations });
}

/**
 * @api {post} /integrations/groups/:groupId Create integration
 * @apiPermission groupAdmin
 * @apiName CreateIntegration
 * @apiGroup Integrations
 *
 * @apiParam {String} groupId Group ID
 * @apiParam (Body) {String} name Integration name
 * @apiParam (Body) {String} type Integration type
 * @apiParam (Body) {String} provider Provider identifier
 * @apiParam (Body) {String} apiKey API key
 * @apiParam (Body) {String} [apiHost] Optional API host for self-hosted
 * @apiParam (Body) {String} [productId] Optional product ID (for Infomaniak)
 * @apiParam (Body) {Object} [config] Provider-specific configuration
 */
async function createIntegration(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const integration = await integrationService.createIntegration({
    ...pick(body, CREATE_FIELDS),
    _company: groupId,
  });

  res.status(201).json(integration);
}

/**
 * @api {get} /integrations/:integrationId Get integration details
 * @apiPermission groupAdmin
 * @apiName GetIntegration
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 */
async function getIntegration(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  const integration =
    await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
      user,
      integrationId,
    });

  res.json(integration);
}

/**
 * @api {put} /integrations/:integrationId Update integration
 * @apiPermission groupAdmin
 * @apiName UpdateIntegration
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 * @apiParam (Body) {String} [name] Integration name
 * @apiParam (Body) {String} [apiKey] API key
 * @apiParam (Body) {String} [apiHost] API host
 * @apiParam (Body) {String} [productId] Product ID
 * @apiParam (Body) {Object} [config] Configuration
 * @apiParam (Body) {Boolean} [isActive] Active status
 */
async function updateIntegration(req, res) {
  const { user, params, body } = req;
  const { integrationId } = params;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  const integration = await integrationService.updateIntegration({
    ...pick(body, UPDATE_FIELDS),
    integrationId,
  });

  res.json(integration);
}

/**
 * @api {delete} /integrations/:integrationId Delete integration
 * @apiPermission groupAdmin
 * @apiName DeleteIntegration
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
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
 *
 * @apiParam {String} integrationId Integration ID
 * @apiParam (Body) {String} [apiKey] Optional API key to test (if not provided, uses stored key)
 * @apiParam (Body) {String} [apiHost] Optional API host to test (if not provided, uses stored host)
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
 * @api {get} /integrations/:integrationId/models Get available models for integration
 * @apiPermission groupAdmin
 * @apiName GetIntegrationModels
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 *
 * @apiSuccess {Array} models List of available models
 * @apiSuccess {Boolean} dynamic Whether the list was fetched dynamically from the provider
 */
async function getModels(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  const integration =
    await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
      user,
      integrationId,
    });

  const provider = ProviderFactory.createProvider(integration);
  const capabilities = provider.getCapabilities();

  try {
    // If the provider supports live model listing (e.g. fetches from the provider API)
    if (typeof provider.getAvailableModels === 'function') {
      const models = await provider.getAvailableModels();
      return res.json({ models, dynamic: true, capabilities });
    }

    // Otherwise delegate to the provider's own static list
    const staticModels = provider.getStaticModels();
    return res.json({ models: staticModels, dynamic: false, capabilities });
  } catch (error) {
    logger.error('Error fetching models:', error.message);
    // Return empty model list but preserve capabilities so the UI stays coherent
    return res.json({
      models: [],
      dynamic: false,
      capabilities,
      error: error.message,
    });
  }
}
