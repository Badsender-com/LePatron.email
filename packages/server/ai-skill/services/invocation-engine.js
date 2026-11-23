'use strict';

const { Groups } = require('../../common/models.common.js');
const aiFeatureService = require('../../ai-feature/ai-feature.service.js');
const { resolveConfig } = require('./config-resolver.service.js');
const { configError } = require('./invocation-config-error.js');

const { FeatureResolutionReasons } = aiFeatureService;

/**
 * Where an invocation runs: the company it is made for, and the engine that
 * company configured for the feature.
 */

// Why the engine could not be resolved, in words. The shared helper reports a
// reason code; turning it back into a sentence stays here because the wording is
// about skills ("configure a 'skill' integration"), not about the generic
// feature machinery. This is what delegating must not lose: the helper used to
// return a bare null, and these distinct messages are the reason ai-skill had
// reimplemented the walk in the first place.
const ENGINE_ERROR_MESSAGES = {
  [FeatureResolutionReasons.NO_CONFIG]: (groupId, featureType) =>
    `Group ${groupId} has no AIFeatureConfig — configure a '${featureType}' integration`,
  [FeatureResolutionReasons.FEATURE_INACTIVE]: (groupId, featureType) =>
    `Group ${groupId} has no active '${featureType}' feature configuration`,
  [FeatureResolutionReasons.NO_INTEGRATION]: (groupId, featureType) =>
    `Group ${groupId} has an active '${featureType}' feature but no integration selected`,
  [FeatureResolutionReasons.INTEGRATION_INACTIVE]: (groupId, featureType) =>
    `Group ${groupId} has a '${featureType}' integration that is inactive`,
};

// The Group document itself stays this module's business: it carries whether
// it is the platform company, the RGPD content opt-out and the log retention
// window, none of which the shared feature helper knows or should know about.
async function loadGroup(groupId) {
  const group = await Groups.findById(groupId).lean();
  if (!group) {
    throw configError(404, `Group ${groupId} not found`);
  }
  return group;
}

/**
 * What the company lets the invocation log: its content opt-out, and the
 * retention that stamps the TTL deadline without the logger re-reading it.
 */
function loggingPolicy(group) {
  return {
    allowContent: group ? group.logSkillInvocationContent !== false : true,
    retentionDays: group ? group.logRetentionDays : undefined,
  };
}

/**
 * Resolve the Integration to use for a Group via the AIFeatureConfig.
 *
 * ENGINE RESOLUTION axis (NOT analytics — that is invoke()'s
 * `invocationSource` param). Resolves exactly the feature type the caller
 * names, with no fallback to 'skill': a group that has not enabled a client
 * feature must not get it through the generic engine.
 *
 * Throws a CONFIG_ERROR if not configured.
 */
async function resolveGroupIntegration(groupId, featureType) {
  const resolved = await aiFeatureService.resolveActiveFeature({
    groupId,
    featureType,
  });
  if (!resolved.ok) {
    const toMessage = ENGINE_ERROR_MESSAGES[resolved.reason];
    const err = configError(
      400,
      toMessage
        ? toMessage(groupId, featureType)
        : `Group ${groupId} has no usable '${featureType}' engine (${resolved.reason})`
    );
    // Lets a client feature tell "not enabled for this group" apart from any
    // other configuration failure, without parsing the message.
    err.featureResolutionReason = resolved.reason;
    throw err;
  }

  return {
    integration: resolved.integration,
    groupFeatureConfig: resolved.feature.config || {},
  };
}

/**
 * The engine of the invocation and the settings it runs with: the group's
 * feature config, over the version's model hints, over the defaults.
 *
 * @returns {Promise<{ integration: Object, groupFeatureConfig: Object, config: Object }>}
 */
async function resolveEngine({ groupId, featureType, version }) {
  const { integration, groupFeatureConfig } = await resolveGroupIntegration(
    groupId,
    featureType
  );
  const config = resolveConfig({
    integration,
    groupFeatureConfig,
    skillModelHints: version.modelHints || {},
    defaults: {},
  });
  return { integration, groupFeatureConfig, config };
}

module.exports = { loadGroup, loggingPolicy, resolveEngine };
