'use strict';

const { Integrations, AIFeatureConfigs } = require('../common/models.common');
const { Types } = require('mongoose');
const {
  NotFound,
  Conflict,
  InternalServerError,
  Unauthorized,
} = require('http-errors');
const logger = require('../utils/logger.js');
const ERROR_CODES = require('../constant/error-codes.js');
const groupService = require('../group/group.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const IntegrationTypes = require('../constant/integration-type.js');

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
};

/**
 * Check if user has access to integration
 */
async function checkIfUserIsAuthorizedToAccessIntegration({
  user,
  integrationId,
}) {
  const integration = await findById(integrationId);
  if (!user.isAdmin) {
    if (user?.group?.id !== integration?._company?.toString()) {
      throw new Unauthorized(ERROR_CODES.FORBIDDEN_INTEGRATION_ACCESS);
    }
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
    productId,
    config: config || {},
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

  // Keep only fields explicitly provided in the request
  const updateData = Object.fromEntries(
    Object.entries({
      name,
      type,
      provider,
      apiKey,
      apiHost,
      productId,
      config,
      isActive,
    }).filter(([, value]) => value !== undefined)
  );

  // Reset validation status if credentials changed
  if (
    apiKey !== undefined ||
    apiHost !== undefined ||
    productId !== undefined
  ) {
    updateData.validationStatus = 'pending';
    updateData.lastValidatedAt = null;
  }

  const updated = await Integrations.findByIdAndUpdate(
    Types.ObjectId(integrationId),
    updateData,
    { new: true }
  );

  // When an integration is deactivated, disable all AI features using it
  if (isActive === false) {
    await deactivateFeaturesForIntegration(integrationId);
  }

  return updated;
}

/**
 * Delete an integration
 */
async function deleteIntegration({ integrationId }) {
  await findById(integrationId);

  const result = await Integrations.deleteOne({
    _id: Types.ObjectId(integrationId),
  });

  if (result.deletedCount !== 1) {
    throw new InternalServerError(ERROR_CODES.FAILED_INTEGRATION_DELETE);
  }

  return result;
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
  if (result.nModified > 0) {
    logger.log(
      `Deactivated AI features for integration ${integrationId} (${result.nModified} config(s) updated)`
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
    const siteUrl = apiHost ?? integration.apiHost;
    const secretKey = apiKey ?? integration.apiKey;

    // Basic validation
    if (!siteUrl || !secretKey) {
      isValid = false;
    } else {
      // URL format validation
      try {
        new URL(siteUrl);
        // For Metabase, validate that the secret key looks like a JWT secret (at least 32 chars)
        isValid = secretKey.length >= 32;
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
