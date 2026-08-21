'use strict';

const { AIFeatureConfigs, Integrations } = require('../common/models.common');
const { Types } = require('mongoose');
const { NotFound, BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { AIFeatureTypeValues } = require('../constant/ai-feature-type.js');
const IntegrationTypes = require('../constant/integration-type.js');
const groupService = require('../group/group.service.js');

/**
 * Reasons a feature cannot be used. Consumers that only need "usable or not"
 * should call getActiveFeatureWithIntegration instead.
 */
const FeatureResolutionReasons = Object.freeze({
  NO_CONFIG: 'NO_CONFIG',
  FEATURE_INACTIVE: 'FEATURE_INACTIVE',
  NO_INTEGRATION: 'NO_INTEGRATION',
  INTEGRATION_INACTIVE: 'INTEGRATION_INACTIVE',
});

module.exports = {
  getOrCreateConfig,
  updateFeatureConfig,
  getFeatureConfig,
  getActiveFeatureWithIntegration,
  resolveActiveFeature,
  FeatureResolutionReasons,
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
    config = await AIFeatureConfigs.create({
      _company: Types.ObjectId(groupId),
      features: AIFeatureTypeValues.map(defaultFeature),
    });

    config = await AIFeatureConfigs.findById(config._id).populate(
      'features.integration'
    );
    return config;
  }

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
 * Resolve a Group's feature and its integration, saying WHY when it cannot.
 *
 * The single place that knows how to walk Group → AIFeatureConfig →
 * Integration. Every module needing an AI engine goes through here rather than
 * re-querying the three collections, which is how the two paths that used to
 * exist had already drifted apart (cf. review A2).
 *
 * @returns {Promise<{ok: true, feature: Object, integration: Object} |
 *                   {ok: false, reason: string}>}
 */
async function resolveActiveFeature({ groupId, featureType }) {
  const aiConfig = await AIFeatureConfigs.findOne({
    _company: Types.ObjectId(groupId),
  }).populate('features.integration');

  if (!aiConfig) {
    return { ok: false, reason: FeatureResolutionReasons.NO_CONFIG };
  }

  // A usable entry wins over a stale duplicate, preserving the behaviour of the
  // single `find` this replaced; the fallback exists only to report a reason.
  const candidates = (aiConfig.features || []).filter(
    (f) => f.featureType === featureType
  );
  const feature =
    candidates.find((f) => f.isActive && f.integration) || candidates[0];

  if (!feature || !feature.isActive) {
    return { ok: false, reason: FeatureResolutionReasons.FEATURE_INACTIVE };
  }
  if (!feature.integration) {
    return { ok: false, reason: FeatureResolutionReasons.NO_INTEGRATION };
  }
  if (!feature.integration.isActive) {
    return { ok: false, reason: FeatureResolutionReasons.INTEGRATION_INACTIVE };
  }

  return { ok: true, feature, integration: feature.integration };
}

/**
 * Get active feature configuration with its integration (for actual use).
 * Returns null if the feature is not active or no integration is configured —
 * call resolveActiveFeature when the reason matters.
 */
async function getActiveFeatureWithIntegration({ groupId, featureType }) {
  const resolved = await resolveActiveFeature({ groupId, featureType });
  if (!resolved.ok) {
    return null;
  }
  return {
    feature: resolved.feature,
    integration: resolved.integration,
  };
}
