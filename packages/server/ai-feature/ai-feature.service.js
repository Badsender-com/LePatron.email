'use strict';

const { AIFeatureConfigs, Integrations } = require('../common/models.common');
const { Types } = require('mongoose');
const { NotFound, BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const groupService = require('../group/group.service.js');

module.exports = {
  getOrCreateConfig,
  updateFeatureConfig,
  getFeatureConfig,
  getActiveFeatureWithIntegration,
};

/**
 * Get or create AI feature configuration for a group
 */
async function getOrCreateConfig({ groupId }) {
  await groupService.findById(groupId);

  let config = await AIFeatureConfigs.findOne({
    _company: Types.ObjectId(groupId),
  }).populate('features.integration');

  if (!config) {
    // Create default config with all feature types
    const defaultFeatures = Object.values(AIFeatureTypes).map(
      (featureType) => ({
        featureType,
        integration: null,
        isActive: false,
        config: {
          availableLanguages: [],
          defaultSourceLanguage: 'auto',
        },
      })
    );

    config = await AIFeatureConfigs.create({
      _company: Types.ObjectId(groupId),
      features: defaultFeatures,
    });

    config = await AIFeatureConfigs.findById(config._id).populate(
      'features.integration'
    );
  }

  return config;
}

/**
 * Update a specific feature configuration
 */
async function updateFeatureConfig({
  groupId,
  featureType,
  integrationId,
  isActive,
  config: featureConfig,
}) {
  await groupService.findById(groupId);

  // Validate feature type
  if (!Object.values(AIFeatureTypes).includes(featureType)) {
    throw new BadRequest(ERROR_CODES.UNAUTHORIZED_INTEGRATION_TYPE);
  }

  // If integrationId provided, validate it belongs to this group
  if (integrationId) {
    const integration = await Integrations.findOne({
      _id: Types.ObjectId(integrationId),
      _company: Types.ObjectId(groupId),
    });
    if (!integration) {
      throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
    }
  }

  // Get or create config
  let aiConfig = await getOrCreateConfig({ groupId });

  // Find and update the specific feature
  const featureIndex = aiConfig.features.findIndex(
    (f) => f.featureType === featureType
  );

  const updateData = {};
  if (integrationId !== undefined) {
    updateData[`features.${featureIndex}.integration`] = integrationId
      ? Types.ObjectId(integrationId)
      : null;
  }
  if (isActive !== undefined) {
    updateData[`features.${featureIndex}.isActive`] = isActive;
  }
  if (featureConfig !== undefined) {
    // Merge config
    if (featureConfig.availableLanguages !== undefined) {
      updateData[`features.${featureIndex}.config.availableLanguages`] =
        featureConfig.availableLanguages;
    }
    if (featureConfig.defaultSourceLanguage !== undefined) {
      updateData[`features.${featureIndex}.config.defaultSourceLanguage`] =
        featureConfig.defaultSourceLanguage;
    }
    if (featureConfig.model !== undefined) {
      updateData[`features.${featureIndex}.config.model`] = featureConfig.model;
    }
  }

  if (Object.keys(updateData).length > 0) {
    aiConfig = await AIFeatureConfigs.findByIdAndUpdate(
      aiConfig._id,
      { $set: updateData },
      { new: true }
    ).populate('features.integration');
  }

  return aiConfig;
}

/**
 * Get configuration for a specific feature
 */
async function getFeatureConfig({ groupId, featureType }) {
  const aiConfig = await getOrCreateConfig({ groupId });

  const feature = aiConfig.features.find((f) => f.featureType === featureType);

  if (!feature) {
    throw new NotFound(ERROR_CODES.AI_FEATURE_CONFIG_NOT_FOUND);
  }

  return feature;
}

/**
 * Get active feature configuration with its integration (for actual use)
 * Returns null if feature is not active or no integration configured
 */
async function getActiveFeatureWithIntegration({ groupId, featureType }) {
  const aiConfig = await AIFeatureConfigs.findOne({
    _company: Types.ObjectId(groupId),
  }).populate('features.integration');

  if (!aiConfig) {
    return null;
  }

  const feature = aiConfig.features.find(
    (f) => f.featureType === featureType && f.isActive && f.integration
  );

  if (!feature || !feature.integration || !feature.integration.isActive) {
    return null;
  }

  return {
    feature,
    integration: feature.integration,
  };
}
