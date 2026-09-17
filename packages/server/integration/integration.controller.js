'use strict';

const asyncHandler = require('express-async-handler');
const createError = require('http-errors');
const pick = require('lodash').pick;
const integrationService = require('./integration.service');
const groupService = require('../group/group.service');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const modelListingService = require('../integration-providers/ai/model-listing.service.js');
const { ProviderError } = require('../integration-providers/provider-error.js');
const ERROR_CODES = require('../constant/error-codes.js');
const logger = require('../utils/logger.js');

const MAX_FEED_ITEMS_LIMIT = 50;
const DEFAULT_FEED_ITEMS_LIMIT = 10;

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

// Explicit response whitelist. The integration document holds a decrypted
// `apiKey` in memory (the encryption plugin decrypts it in a post-find hook),
// and `mongoose-hidden` only strips it from `toJSON()` — NOT from `toObject()`
// or a raw spread. Serializing the document directly is therefore one mistake
// away from leaking the key. Build the client payload from this whitelist
// instead of passing the Mongoose document to `res.json`.
const RESPONSE_FIELDS = [
  '_id',
  'id',
  'name',
  'type',
  'provider',
  'apiHost',
  'productId',
  'config',
  'isActive',
  'validationStatus',
  'lastValidatedAt',
  'createdAt',
  'updatedAt',
];

function toIntegrationDto(integration) {
  if (!integration) return integration;
  // Pick from a plain object so all whitelisted fields are present regardless
  // of Mongoose getters/aliases. apiKey is never in RESPONSE_FIELDS, so even
  // though toObject() exposes the decrypted key, it cannot reach the response.
  const plain =
    typeof integration.toObject === 'function'
      ? integration.toObject()
      : integration;
  return pick(plain, RESPONSE_FIELDS);
}

module.exports = {
  createIntegration: asyncHandler(createIntegration),
  updateIntegration: asyncHandler(updateIntegration),
  deleteIntegration: asyncHandler(deleteIntegration),
  getIntegration: asyncHandler(getIntegration),
  listIntegrations: asyncHandler(listIntegrations),
  validateCredentials: asyncHandler(validateCredentials),
  listProviders: asyncHandler(listProviders),
  getModels: asyncHandler(getModels),
  getDashboardCount: asyncHandler(getDashboardCount),
  getFeedItems: asyncHandler(getFeedItems),
  // exported for testing
  toIntegrationDto,
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

  res.json({ items: integrations.map(toIntegrationDto) });
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

  res.status(201).json(toIntegrationDto(integration));
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

  const integration = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
    {
      user,
      integrationId,
    }
  );

  res.json(toIntegrationDto(integration));
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

  res.json(toIntegrationDto(integration));
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
 * @api {get} /integrations/:integrationId/items Fetch normalized items from a data feed integration
 * @apiPermission user
 * @apiName GetFeedItems
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 * @apiQuery {Number} [limit] Max number of items to return (default 10, capped at 50)
 *
 * @apiSuccess {Object[]} items Normalized feed items ({ title, link, description, image, pubDate })
 */
async function getFeedItems(req, res) {
  const { user, params, query } = req;
  const { integrationId } = params;

  const integration = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
    {
      user,
      integrationId,
    }
  );

  const requestedLimit = parseInt(query.limit, 10);
  const limit = Number.isNaN(requestedLimit)
    ? DEFAULT_FEED_ITEMS_LIMIT
    : Math.min(Math.max(requestedLimit, 1), MAX_FEED_ITEMS_LIMIT);

  const provider = ProviderFactory.createProvider(integration);

  let items;
  try {
    items = await provider.fetchItems({ limit });
  } catch (error) {
    logger.error('Failed to fetch feed items:', error.message);
    const status = error instanceof ProviderError ? error.httpStatus : 502;
    throw createError(
      status,
      ERROR_CODES.FEED_ITEMS_FETCH_FAILED + ': ' + error.message
    );
  }

  res.json({ items });
}

/**
 * @api {get} /integrations/:integrationId/dashboard-count Get dashboard count for integration
 * @apiPermission groupAdmin
 * @apiName GetDashboardCount
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 *
 * @apiSuccess {Number} count Number of dashboards using this integration
 */
async function getDashboardCount(req, res) {
  const { user, params } = req;
  const { integrationId } = params;

  await integrationService.checkIfUserIsAuthorizedToAccessIntegration({
    user,
    integrationId,
  });

  const count = await integrationService.countDashboardsForIntegration(
    integrationId
  );

  res.json({ count });
}

/**
 * @api {get} /integrations/:integrationId/models Get available models for integration
 * @apiPermission groupAdmin
 * @apiName GetIntegrationModels
 * @apiGroup Integrations
 *
 * @apiParam {String} integrationId Integration ID
 *
 * @apiQuery {Boolean} [refresh] Bypass the listing cache and re-query the provider
 *
 * @apiSuccess {Array} models List of available models. Each carries `id`,
 *   `label` (`name` is kept as an alias for older clients), an optional
 *   `descriptionKey`, and the `known` / `remote` flags saying whether the
 *   model is described by our catalogue and whether the provider reported it.
 * @apiSuccess {String} source `merged` when the provider's own listing was
 *   used, `catalog` when it was unavailable and the curated list took over
 * @apiSuccess {Boolean} dynamic Deprecated alias for `source !== 'catalog'`
 * @apiSuccess {Boolean} allowCustomModel Whether the UI may accept a
 *   hand-typed identifier
 * @apiSuccess {String} defaultModel Model the provider falls back to when none is configured (null if it has none)
 * @apiSuccess {String} [error] Why the provider listing could not be used
 */
async function getModels(req, res) {
  const { user, params, query } = req;
  const { integrationId } = params;

  const integration = await integrationService.checkIfUserIsAuthorizedToAccessIntegration(
    {
      user,
      integrationId,
    }
  );

  // Three providers now throw from their constructor when their configuration
  // is incomplete (Azure without a host, a compatible endpoint without one,
  // Infomaniak without a productId). Unguarded, that surfaced as a 500 and
  // left the settings screen blank — the one place the admin could fix it.
  let provider;
  try {
    provider = ProviderFactory.createProvider(integration);
  } catch (error) {
    return res.json({
      models: [],
      source: 'catalog',
      dynamic: false,
      capabilities: { supportsModelSelection: true, supportsFormality: false },
      defaultModel: null,
      allowCustomModel: true,
      error: error.message,
    });
  }

  const capabilities = provider.getCapabilities();
  const defaultModel = resolveDefaultModel(provider);

  // Never throws: an unreachable provider degrades to the curated catalogue so
  // the settings screen stays usable, and says so through `error`.
  const {
    models,
    source,
    error,
  } = await modelListingService.listModelsForIntegration(integration, {
    refresh: query.refresh === 'true',
  });

  return res.json({
    models,
    source,
    dynamic: source !== 'catalog',
    capabilities,
    defaultModel,
    // Free typing is what covers models released after this deploy, Azure
    // deployment names, and self-hosted endpoints — anywhere the list cannot
    // be exhaustive. The server validates the shape, not the membership.
    allowCustomModel: capabilities.supportsModelSelection,
    ...(error ? { error } : {}),
  });
}

/**
 * The model a provider silently falls back to when the group leaves the field
 * empty. Exposed so the UI can label its "default" option instead of showing an
 * empty select that suggests no model will be used.
 *
 * `_getDefaultModel` is optional: the base class throws when a subclass has not
 * implemented it, and translation-only providers (DeepL) have no notion of one.
 */
function resolveDefaultModel(provider) {
  if (typeof provider._getDefaultModel !== 'function') return null;
  try {
    return provider._getDefaultModel() || null;
  } catch (error) {
    return null;
  }
}
