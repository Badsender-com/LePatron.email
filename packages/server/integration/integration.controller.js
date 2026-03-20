'use strict';

const asyncHandler = require('express-async-handler');
const integrationService = require('./integration.service');
const groupService = require('../group/group.service');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');

module.exports = {
  createIntegration: asyncHandler(createIntegration),
  updateIntegration: asyncHandler(updateIntegration),
  deleteIntegration: asyncHandler(deleteIntegration),
  readIntegration: asyncHandler(readIntegration),
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

  // Sanitize: never return the actual API keys
  const sanitized = integrations.map(sanitizeIntegration);

  res.json({ items: sanitized });
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
 * @apiParam (Body) {Object} [config] Provider-specific configuration
 */
async function createIntegration(req, res) {
  const { user, params, body } = req;
  const { groupId } = params;
  const { name, type, provider, apiKey, apiHost, productId, config } = body;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const integration = await integrationService.createIntegration({
    name,
    type,
    provider,
    apiKey,
    apiHost,
    productId,
    config,
    _company: groupId,
  });

  res.status(201).json(sanitizeIntegration(integration));
}

/**
 * @api {get} /integrations/:integrationId Get integration details
 * @apiPermission groupAdmin
 * @apiName ReadIntegration
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 */
async function readIntegration(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  const integration = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
    {
      user,
      integrationId,
    }
  );

  res.json(sanitizeIntegration(integration));
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
 * @apiParam (Body) {Object} [config] Configuration
 * @apiParam (Body) {Boolean} [isActive] Active status
 */
async function updateIntegration(req, res) {
  const { user, params, body } = req;
  const { integrationId } = params;
  const { name, type, provider, apiKey, apiHost, productId, config, isActive } =
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
    productId,
    config,
    isActive,
  });

  res.json(sanitizeIntegration(integration));
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
 */
async function validateCredentials(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  const isValid = await integrationService.validateCredentials({
    integrationId,
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

  try {
    const provider = ProviderFactory.createProvider(integration);

    // If the provider supports dynamic model listing
    if (typeof provider.getAvailableModels === 'function') {
      const models = await provider.getAvailableModels();
      return res.json({ models, dynamic: true });
    }

    // Otherwise return static models for the provider
    const staticModels = getStaticModelsForProvider(integration.provider);
    return res.json({ models: staticModels, dynamic: false });
  } catch (error) {
    console.error('Error fetching models:', error.message);
    // Fallback to static models on error
    const staticModels = getStaticModelsForProvider(integration.provider);
    return res.json({ models: staticModels, dynamic: false, error: error.message });
  }
}

/**
 * Get static model list for providers that don't support dynamic listing
 */
function getStaticModelsForProvider(provider) {
  const STATIC_MODELS = {
    openai: [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast, economical)' },
      { id: 'gpt-4o', name: 'GPT-4o (balanced)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (powerful)' },
    ],
    mistral: [
      { id: 'mistral-small-latest', name: 'Mistral Small (fast)' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium (balanced)' },
      { id: 'mistral-large-latest', name: 'Mistral Large (powerful)' },
    ],
  };
  return STATIC_MODELS[provider] || [];
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
