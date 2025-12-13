'use strict';

const asyncHandler = require('express-async-handler');
const aiFeatureService = require('./ai-feature.service');
const groupService = require('../group/group.service');
const AIFeatureTypes = require('../constant/ai-feature-type.js');

module.exports = {
  getConfig: asyncHandler(getConfig),
  updateFeature: asyncHandler(updateFeature),
  listFeatureTypes: asyncHandler(listFeatureTypes),
};

/**
 * @api {get} /ai-features/types List available AI feature types
 * @apiPermission user
 * @apiName ListFeatureTypes
 * @apiGroup AIFeatures
 */
async function listFeatureTypes(req, res) {
  res.json({
    types: Object.values(AIFeatureTypes),
  });
}

/**
 * @api {get} /ai-features/groups/:groupId Get AI features configuration
 * @apiPermission groupAdmin
 * @apiName GetAIFeaturesConfig
 * @apiGroup AIFeatures
 *
 * @apiParam {String} groupId Group ID
 */
async function getConfig(req, res) {
  const { user, params } = req;
  const { groupId } = params;

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const config = await aiFeatureService.getOrCreateConfig({ groupId });

  // Sanitize integrations - don't expose API keys
  const sanitizedConfig = sanitizeConfig(config);

  res.json(sanitizedConfig);
}

/**
 * @api {put} /ai-features/groups/:groupId/features/:featureType Update feature configuration
 * @apiPermission groupAdmin
 * @apiName UpdateFeatureConfig
 * @apiGroup AIFeatures
 *
 * @apiParam {String} groupId Group ID
 * @apiParam {String} featureType Feature type (translation, etc.)
 * @apiParam (Body) {String} [integrationId] Integration to use for this feature
 * @apiParam (Body) {Boolean} [isActive] Active status
 * @apiParam (Body) {Object} [config] Feature-specific configuration
 * @apiParam (Body) {Array} [config.availableLanguages] Available target languages (for translation)
 * @apiParam (Body) {String} [config.defaultSourceLanguage] Default source language (for translation)
 */
async function updateFeature(req, res) {
  const { user, params, body } = req;
  const { groupId, featureType } = params;
  const { integrationId, isActive, config } = body;

  console.log('updateFeature called:', {
    featureType,
    integrationId,
    isActive,
    config,
  });

  await groupService.checkIfUserIsAuthorizedToAccessGroup({ user, groupId });

  const updatedConfig = await aiFeatureService.updateFeatureConfig({
    groupId,
    featureType,
    integrationId,
    isActive,
    config,
  });

  res.json(sanitizeConfig(updatedConfig));
}

/**
 * Sanitize config - mask API keys in integrations
 */
function sanitizeConfig(config) {
  const obj = config.toObject ? config.toObject() : { ...config };

  if (obj.features) {
    obj.features = obj.features.map((feature) => {
      if (feature.integration) {
        return {
          ...feature,
          integration: {
            ...feature.integration,
            apiKey: feature.integration.apiKey ? '••••••••' : null,
          },
        };
      }
      return feature;
    });
  }

  return obj;
}
