'use strict';

const { AIFeatureConfigs } = require('../common/models.common');
const { Types } = require('mongoose');
const AIFeatureTypes = require('../constant/ai-feature-type.js');

// Whether a group can use an AI feature, and with which integration: for the
// invocations and for the flags the editor shows.

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
  FeatureResolutionReasons,
  resolveActiveFeature,
  resolveFromConfig,
  getActiveFeatureWithIntegration,
  getEditorFeatureFlags,
};

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

  return resolveFromConfig(aiConfig, featureType);
}

/**
 * The resolution rule itself, on a config already read: one rule for the
 * engine an invocation gets and for the flags the editor shows, so the button
 * never appears for an engine the invocation would refuse.
 */
function resolveFromConfig(aiConfig, featureType) {
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

/**
 * Which AI features the editor may offer for a group: a feature counts only when
 * it is on AND its integration is active — resolveFromConfig, the very rule
 * invocations apply.
 *
 * One read for every flag, rather than one resolveActiveFeature per feature: the
 * editor asks on every open.
 *
 * @returns {Promise<{hasTranslationFeature: boolean, hasTextGenerationFeature: boolean}>}
 */
async function getEditorFeatureFlags({ groupId }) {
  const aiConfig = await AIFeatureConfigs.findOne({
    _company: Types.ObjectId(groupId),
  }).populate('features.integration');
  const usable = (featureType) => resolveFromConfig(aiConfig, featureType).ok;
  return {
    hasTranslationFeature: usable(AIFeatureTypes.TRANSLATION),
    hasTextGenerationFeature: usable(AIFeatureTypes.TEXT_GENERATION),
  };
}
