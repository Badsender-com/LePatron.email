'use strict';

const { AIFeatureConfigs, Integrations } = require('../common/models.common');
const { Types } = require('mongoose');
const { NotFound, BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { AIFeatureTypeValues } = require('../constant/ai-feature-type.js');
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
    const defaultFeatures = AIFeatureTypeValues.map((featureType) => ({
      featureType,
      integration: null,
      isActive: false,
      config: {
        availableLanguages: [],
        defaultSourceLanguage: 'auto',
      },
    }));

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
 * Validate that integration exists and belongs to the group
 */
async function validateIntegrationOwnership({ integrationId, groupId }) {
  const integration = await Integrations.findOne({
    _id: Types.ObjectId(integrationId),
    _company: Types.ObjectId(groupId),
  });
  if (!integration) {
    throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
  }
}

// Config sub-fields that can be partially updated via $set
const FEATURE_CONFIG_FIELDS = [
  'availableLanguages',
  'defaultSourceLanguage',
  'model',
];

/**
 * Update a specific feature configuration
 *
 * Uses Mongoose positional $set to update only the fields that were
 * provided in the request body, without overwriting the rest of the
 * feature sub-document. Each field is mapped to its nested path inside
 * the features array: "features.<index>.<field>".
 */
async function updateFeatureConfig({
  groupId,
  featureType,
  integrationId,
  isActive,
  config: featureConfig,
}) {
  await groupService.findById(groupId);

  if (!AIFeatureTypeValues.includes(featureType)) {
    throw new BadRequest(ERROR_CODES.UNAUTHORIZED_INTEGRATION_TYPE);
  }

  if (integrationId) {
    await validateIntegrationOwnership({ integrationId, groupId });
  }

  // Validate minimum 2 languages when provided
  if (featureConfig?.availableLanguages) {
    const langs = featureConfig.availableLanguages;
    if (langs.length > 0 && langs.length < 2) {
      throw new BadRequest(ERROR_CODES.MIN_LANGUAGES_REQUIRED);
    }
  }

  let aiConfig = await getOrCreateConfig({ groupId });

  const featureIndex = aiConfig.features.findIndex(
    (f) => f.featureType === featureType
  );

  const prefix = `features.${featureIndex}`;
  const updateData = {};

  if (integrationId !== undefined) {
    updateData[`${prefix}.integration`] = integrationId
      ? Types.ObjectId(integrationId)
      : null;
  }
  if (isActive !== undefined) {
    updateData[`${prefix}.isActive`] = isActive;
  }
  // Merge only the provided config sub-fields so that omitted fields
  // keep their current value in the database.
  if (featureConfig) {
    for (const field of FEATURE_CONFIG_FIELDS) {
      if (featureConfig[field] !== undefined) {
        updateData[`${prefix}.config.${field}`] = featureConfig[field];
      }
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
