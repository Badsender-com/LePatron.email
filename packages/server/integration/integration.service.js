'use strict';

const { Integrations } = require('../common/models.common');
const { Types } = require('mongoose');
const {
  NotFound,
  Conflict,
  InternalServerError,
  Unauthorized,
} = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const groupService = require('../group/group.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');

module.exports = {
  createIntegration,
  updateIntegration,
  deleteIntegration,
  findOne,
  findAllByGroup,
  findByGroupAndType,
  findActiveByGroup,
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
  const integration = await findOne(integrationId);
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
  config,
  isActive,
}) {
  const integration = await findOne(integrationId);

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

  const updateData = {};
  if (name !== undefined) updateData.name = name;
  if (type !== undefined) updateData.type = type;
  if (provider !== undefined) updateData.provider = provider;
  if (apiKey !== undefined) updateData.apiKey = apiKey;
  if (apiHost !== undefined) updateData.apiHost = apiHost;
  if (config !== undefined) updateData.config = config;
  if (isActive !== undefined) updateData.isActive = isActive;

  // Reset validation status if credentials changed
  if (apiKey !== undefined || apiHost !== undefined) {
    updateData.validationStatus = 'pending';
    updateData.lastValidatedAt = null;
  }

  return Integrations.findByIdAndUpdate(
    Types.ObjectId(integrationId),
    updateData,
    { new: true }
  );
}

/**
 * Delete an integration
 */
async function deleteIntegration({ integrationId }) {
  await findOne(integrationId);

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
async function findOne(integrationId) {
  const integration = await Integrations.findOne({
    _id: Types.ObjectId(integrationId),
  });

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
 * Validate integration credentials using the provider factory
 */
async function validateCredentials({ integrationId }) {
  const integration = await findOne(integrationId);

  let isValid = false;
  try {
    const provider = ProviderFactory.createProvider(integration);
    isValid = await provider.validateCredentials();
  } catch (error) {
    console.error('Validation error:', error.message);
    isValid = false;
  }

  await Integrations.findByIdAndUpdate(Types.ObjectId(integrationId), {
    validationStatus: isValid ? 'valid' : 'invalid',
    lastValidatedAt: new Date(),
  });

  return isValid;
}
