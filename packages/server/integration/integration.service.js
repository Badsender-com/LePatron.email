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

module.exports = {
  createIntegration,
  updateIntegration,
  deleteIntegration,
  findOne,
  findAllByGroup,
  findByGroupAndType,
  findActiveByGroupAndType,
  validateCredentials,
  checkIfUserIsAuthorizedToAccessIntegration,
  updateDashboards,
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
  dashboards,
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
    dashboards: dashboards || [],
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
  dashboards,
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
  if (dashboards !== undefined) updateData.dashboards = dashboards;
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
 * Update dashboards for an integration
 */
async function updateDashboards({ integrationId, dashboards }) {
  await findOne(integrationId);

  return Integrations.findByIdAndUpdate(
    Types.ObjectId(integrationId),
    { dashboards },
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
  if (!integrationId || !Types.ObjectId.isValid(integrationId)) {
    throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
  }

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
 * Validate integration credentials using the provider
 */
async function validateCredentials({ integrationId, apiKey, apiHost }) {
  const integration = await findOne(integrationId);

  // Use provided credentials or fall back to stored ones
  const siteUrl = apiHost ?? integration.apiHost;
  const secretKey = apiKey ?? integration.apiKey;

  // Basic validation
  if (!siteUrl || !secretKey) {
    return false;
  }

  // URL format validation
  try {
    new URL(siteUrl);
  } catch {
    return false;
  }

  // For Metabase, we can't really test without making a request
  // Just validate that the secret key looks like a JWT secret (at least 32 chars)
  if (secretKey.length < 32) {
    return false;
  }

  // Mark as valid
  await Integrations.findByIdAndUpdate(Types.ObjectId(integrationId), {
    validationStatus: 'valid',
    lastValidatedAt: new Date(),
  });

  return true;
}
