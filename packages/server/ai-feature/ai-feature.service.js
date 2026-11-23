'use strict';

const { AIFeatureConfigs, Integrations } = require('../common/models.common');
const { Types } = require('mongoose');
const { NotFound, BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');

const { AIFeatureTypeValues, TEXT_FEATURE_TYPES } = AIFeatureTypes;
const { validateFeatureConfig } = require('./ai-feature.validation.js');
const IntegrationTypes = require('../constant/integration-type.js');
const groupService = require('../group/group.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const {
  FeatureResolutionReasons,
  resolveActiveFeature,
  getActiveFeatureWithIntegration,
  getEditorFeatureFlags,
} = require('./ai-feature-resolution.js');

module.exports = {
  getOrCreateConfig,
  updateFeatureConfig,
  getFeatureConfig,
  // The resolution of a feature, kept reachable here for its callers.
  getActiveFeatureWithIntegration,
  resolveActiveFeature,
  getEditorFeatureFlags,
  FeatureResolutionReasons,
};

// MongoDB's answer to an insert that would break a unique index.
const DUPLICATE_KEY = 11000;

/**
 * Get or create AI feature configuration for a group
 */
async function getOrCreateConfig({ groupId }) {
  await groupService.findById(groupId);

  let config = await findOrInsertConfig(groupId);

  // Backfill feature types added to the enum AFTER this config was created
  // (e.g. 'skill' on configs that predate it). Without this, a missing feature
  // can't be configured: updateFeatureConfig's findIndex returns -1 and the
  // write is lost. Idempotent — only adds the truly missing ones.
  const present = new Set(config.features.map((f) => f.featureType));
  const missing = AIFeatureTypeValues.filter((t) => !present.has(t));
  if (missing.length) {
    // Conditional push per type: the `$ne` filter makes each insert a no-op if
    // the type is already there, so two concurrent getOrCreateConfig calls can't
    // double-insert the same feature.
    for (const featureType of missing) {
      await AIFeatureConfigs.updateOne(
        { _id: config._id, 'features.featureType': { $ne: featureType } },
        { $push: { features: defaultFeature(featureType) } }
      );
    }
    config = await AIFeatureConfigs.findById(config._id).populate(
      'features.integration'
    );
  }

  return config;
}

/**
 * The group's config, inserted with every feature type when it has none, in
 * one operation: two first reads at once (two tabs, two requests of a page)
 * would otherwise both insert, and the second fail on the unique `_company`.
 * The upsert that still loses that race finds, when tried again, the config
 * the other one inserted.
 */
async function findOrInsertConfig(groupId) {
  const upsert = () =>
    AIFeatureConfigs.findOneAndUpdate(
      { _company: Types.ObjectId(groupId) },
      { $setOnInsert: { features: AIFeatureTypeValues.map(defaultFeature) } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).populate('features.integration');
  try {
    return await upsert();
  } catch (error) {
    if (error?.code !== DUPLICATE_KEY) throw error;
    return upsert();
  }
}

function defaultFeature(featureType) {
  return {
    featureType,
    integration: null,
    isActive: false,
    config: {
      availableLanguages: [],
      defaultSourceLanguage: 'auto',
    },
  };
}

/**
 * Validate that integration exists, belongs to the group, and is an AI
 * integration. The type check matters: without it a `dashboard` (Metabase) or
 * `data_feed` (RSS) integration can be wired as an AI engine — the client-side
 * `type=ai` filter on the selectors is a convenience, not a guarantee.
 */
async function validateIntegrationOwnership({ integrationId, groupId }) {
  const integration = await Integrations.findOne({
    _id: Types.ObjectId(integrationId),
    _company: Types.ObjectId(groupId),
  });
  if (!integration) {
    throw new NotFound(ERROR_CODES.INTEGRATION_NOT_FOUND);
  }
  if (integration.type !== IntegrationTypes.AI) {
    throw new BadRequest(ERROR_CODES.UNAUTHORIZED_INTEGRATION_TYPE);
  }
  return integration;
}

// Config sub-fields that can be partially updated via $set
const FEATURE_CONFIG_FIELDS = [
  'availableLanguages',
  'defaultSourceLanguage',
  'model',
  'formality',
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
    const integration = await validateIntegrationOwnership({
      integrationId,
      groupId,
    });
    if (
      TEXT_FEATURE_TYPES.includes(featureType) &&
      !ProviderFactory.canGenerateText(integration.provider)
    ) {
      throw new BadRequest(ERROR_CODES.INTEGRATION_CANNOT_GENERATE_TEXT);
    }
  }

  validateFeatureConfig(featureConfig);

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
