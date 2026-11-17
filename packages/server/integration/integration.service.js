'use strict';

const {
  Integrations,
  AIFeatureConfigs,
  Dashboards,
} = require('../common/models.common');
const { Types } = require('mongoose');
const {
  NotFound,
  Conflict,
  InternalServerError,
  Unauthorized,
  BadRequest,
} = require('http-errors');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const permissions = require('../account/permissions.js');
const groupService = require('../group/group.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const IntegrationTypes = require('../constant/integration-type.js');
const IntegrationProviders = require('../constant/integration-provider.js');
const {
  normalizeProductId,
  assertApiKeyResent,
  validateIntegrationConfig,
  validateApiHost,
  isHostChange,
} = require('./integration.validation.js');

module.exports = {
  createIntegration,
  updateIntegration,
  deleteIntegration,
  findById,
  findAllByGroup,
  findByGroupAndType,
  findActiveByGroup,
  findActiveByGroupAndType,
  validateCredentials,
  checkIfUserIsAuthorizedToAccessIntegration,
  countDashboardsForIntegration,
  listImageHostFolders,
};

// The providers of the image host type (ADR 0028).
const IMAGE_HOST_PROVIDERS = [IntegrationProviders.EMARSYS];

/**
 * Check if user has access to integration
 */
async function checkIfUserIsAuthorizedToAccessIntegration({
  user,
  integrationId,
}) {
  const integration = await findById(integrationId);
  if (!permissions.canAccessGroup(user, integration?._company)) {
    throw new Unauthorized(ERROR_CODES.FORBIDDEN_INTEGRATION_ACCESS);
  }
  return integration;
}

/**
 * Create a new integration
 */
async function createIntegration({
  name,
  type,
  provider,
  apiKey,
  apiHost,
  productId,
  config,
  _company,
}) {
  await validateApiHost(apiHost, { type });
  const normalizedProductId = normalizeProductId(productId);

  // Check for duplicates
  if (await Integrations.exists({ name, _company, type })) {
    throw new Conflict(ERROR_CODES.INTEGRATION_NAME_ALREADY_EXIST);
  }

  return Integrations.create({
    name,
    type,
    provider,
    apiKey,
    apiHost,
    productId: normalizedProductId,
    config: validateIntegrationConfig(provider, config),
    _company,
    isActive: true,
    validationStatus: 'pending',
  });
}

/**
 * Update an existing integration
 */
async function updateIntegration({
  integrationId,
  name,
  type,
  provider,
  apiKey,
  apiHost,
  productId,
  config,
  isActive,
}) {
  const integration = await findById(integrationId);

  // Check for name conflicts if name changed
  if (name && name !== integration.name) {
    if (
      await Integrations.exists({
        name,
        _company: integration._company,
        type: type || integration.type,
        _id: { $ne: Types.ObjectId(integrationId) },
      })
    ) {
      throw new Conflict(ERROR_CODES.INTEGRATION_NAME_ALREADY_EXIST);
    }
  }

  // Only a new host is checked: one saved before a rule tightened (an AI
  // endpoint on http://) must stay editable — renamed, switched off — without
  // being refused over a host nobody touched.
  if (isHostChange({ integration, apiHost })) {
    await validateApiHost(apiHost, { type: type || integration.type });
  }
  const normalizedProductId = normalizeProductId(productId);
  assertApiKeyResent({ integration, provider, apiHost, apiKey });
  const providerChanged =
    provider !== undefined && provider !== integration.provider;
  let validatedConfig;
  if (config !== undefined) {
    validatedConfig = validateIntegrationConfig(
      provider || integration.provider,
      config
    );
  } else if (providerChanged) {
    // The old provider's settings mean nothing to the new one, and were only
    // ever checked against the old one. Refused when the new one cannot work
    // without settings (an Emarsys root folder).
    validatedConfig = validateIntegrationConfig(provider, {});
  }

  // Apply only fields explicitly provided in the request
  if (name !== undefined) integration.name = name;
  if (type !== undefined) integration.type = type;
  if (provider !== undefined) integration.provider = provider;
  if (apiKey !== undefined) integration.apiKey = apiKey;
  if (apiHost !== undefined) integration.apiHost = apiHost;
  if (productId !== undefined) integration.productId = normalizedProductId;
  if (validatedConfig !== undefined) integration.config = validatedConfig;
  if (isActive !== undefined) integration.isActive = isActive;

  // Reset validation status if credentials changed
  if (
    apiKey !== undefined ||
    apiHost !== undefined ||
    productId !== undefined
  ) {
    integration.validationStatus = 'pending';
    integration.lastValidatedAt = null;
  }

  await integration.save();

  // When an integration is deactivated, disable all AI features using it
  if (isActive === false) {
    await deactivateFeaturesForIntegration(integrationId);
  }

  return integration;
}

/**
 * Delete an integration and its associated dashboards
 */
async function deleteIntegration({ integrationId }) {
  await findById(integrationId);

  // Delete all dashboards associated with this integration
  const dashboardResult = await Dashboards.deleteMany({
    _integration: Types.ObjectId(integrationId),
  });

  if (dashboardResult.deletedCount > 0) {
    logger.log(
      `Deleted ${dashboardResult.deletedCount} dashboard(s) for integration ${integrationId}`
    );
  }

  const result = await Integrations.deleteOne({
    _id: Types.ObjectId(integrationId),
  });

  if (result.deletedCount !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_INTEGRATION_DELETE);
  }

  return result;
}

/**
 * Count dashboards associated with an integration
 */
async function countDashboardsForIntegration(integrationId) {
  return Dashboards.countDocuments({
    _integration: Types.ObjectId(integrationId),
  });
}

/**
 * Find one integration by ID
 */
async function findById(integrationId) {
  if (!integrationId || !Types.ObjectId.isValid(integrationId)) {
    throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  const integration = await Integrations.findById(
    Types.ObjectId(integrationId)
  );

  if (!integration) {
    throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

  return integration;
}

/**
 * Find all integrations for a group
 */
async function findAllByGroup({ groupId }) {
  await groupService.findById(groupId);
  return Integrations.find({ _company: Types.ObjectId(groupId) }).sort({
    name: 1,
  });
}

/**
 * Find integrations by group and type
 */
async function findByGroupAndType({ groupId, type }) {
  await groupService.findById(groupId);
  return Integrations.find({
    _company: Types.ObjectId(groupId),
    type,
  }).sort({ name: 1 });
}

/**
 * Find active integrations for a group
 */
async function findActiveByGroup({ groupId }) {
  await groupService.findById(groupId);
  return Integrations.find({
    _company: Types.ObjectId(groupId),
    isActive: true,
  }).sort({ name: 1 });
}

/**
 * Find active integrations by group and type
 */
async function findActiveByGroupAndType({ groupId, type }) {
  await groupService.findById(groupId);
  return Integrations.find({
    _company: Types.ObjectId(groupId),
    type,
    isActive: true,
  }).sort({ name: 1 });
}

/**
 * Deactivate all AI features that reference a given integration
 */
async function deactivateFeaturesForIntegration(integrationId) {
  const objectId = Types.ObjectId(integrationId);
  const result = await AIFeatureConfigs.updateMany(
    { 'features.integration': objectId, 'features.isActive': true },
    { $set: { 'features.$[feat].isActive': false } },
    { arrayFilters: [{ 'feat.integration': objectId, 'feat.isActive': true }] }
  );
  if (result.modifiedCount > 0) {
    logger.log(
      `Deactivated AI features for integration ${integrationId} (${result.modifiedCount} config(s) updated)`
    );
  }
}

/**
 * Validate integration credentials
 * - For dashboard providers: basic URL/key validation
 * - For AI providers: uses ProviderFactory
 */
async function validateCredentials({ integrationId, apiKey, apiHost }) {
  const integration = await findById(integrationId);

  let isValid = false;

  // Dashboard providers use basic validation
  if (integration.type === IntegrationTypes.DASHBOARD) {
    let siteUrl = apiHost ?? integration.apiHost;
    const secretKey = apiKey ?? integration.apiKey;

    // Basic validation
    if (!siteUrl || !secretKey) {
      isValid = false;
    } else {
      // URL format validation
      try {
        // Normalize URL: remove trailing slash
        siteUrl = siteUrl.replace(/\/+$/, '');
        const parsed = new URL(siteUrl);
        // For Metabase, validate that the secret key looks like a JWT secret (at least 32 chars)
        isValid = !!parsed.hostname && secretKey.length >= 32;
      } catch {
        isValid = false;
      }
    }
  } else {
    // AI providers use ProviderFactory
    try {
      const provider = ProviderFactory.createProvider(integration);
      isValid = await provider.validateCredentials();
    } catch (error) {
      logger.error('Validation error:', error.message);
      isValid = false;
    }
  }

  await Integrations.findByIdAndUpdate(Types.ObjectId(integrationId), {
    validationStatus: isValid ? 'valid' : 'invalid',
    lastValidatedAt: new Date(),
  });

  return isValid;
}

/**
 * The folders of an image host's account, for the tech admin to pick the root
 * folder from: before the integration is saved, from the credentials being
 * typed; while editing it, from its stored secret, which never goes back to
 * the screen. What is being typed wins over what is stored.
 *
 * @param {Object} params
 * @param {string} params.groupId the company the request is made for
 * @param {string} [params.integrationId] the integration being edited
 * @param {string} [params.provider] the provider, for a new integration
 * @param {string} [params.apiKey] the secret being typed
 * @param {Object} [params.config] the settings being typed (`clientId`)
 * @returns {Promise<Array<{ id: number, parent: number, name: string }>>}
 * @throws {BadRequest} INTEGRATION_CONFIG_INVALID for a provider that is not an
 *   image host
 * @throws {ProviderError} when the host refuses the credentials or fails
 */
async function listImageHostFolders({
  groupId,
  integrationId,
  provider,
  apiKey,
  config,
}) {
  let stored = null;
  if (integrationId) {
    stored = await findById(integrationId);
    // The stored secret leaves for its own company's account only.
    if (String(stored._company) !== String(groupId)) {
      throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
    }
  }

  const providerName = stored ? stored.provider : provider;
  if (!IMAGE_HOST_PROVIDERS.includes(providerName)) {
    throw new BadRequest(ERROR_CODES.INTEGRATION_CONFIG_INVALID);
  }
  const clientId = config?.clientId || stored?.config?.clientId;
  // The client ID goes into a header: checked by the rule that guards what is
  // stored, the root folder aside since it is what is being chosen.
  validateIntegrationConfig(providerName, { clientId, rootFolderId: 1 });

  const host = ProviderFactory.createProvider({
    type: IntegrationTypes.ASSET_HOSTING,
    provider: providerName,
    apiKey: apiKey || stored?.apiKey,
    config: { clientId },
  });
  return host.listFolders();
}
