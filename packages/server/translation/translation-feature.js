'use strict';

const { BadRequest } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const aiFeatureService = require('../ai-feature/ai-feature.service.js');

// What every translation entry point needs before it calls a provider: the
// group's feature, checked against the target language, and the context
// DeepL is given. Shared by the mailing translation and the single text and
// block routes (translation.service.js).

/**
 * The group's active translation feature, refused when it does not offer the
 * target language.
 *
 * @returns {Promise<{ integration: Object, feature: Object }>}
 */
async function getTranslationFeature({ groupId, targetLanguage }) {
  const featureConfig = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.TRANSLATION,
  });

  if (!featureConfig) {
    throw new BadRequest(ERROR_CODES.NO_INTEGRATION_FOR_FEATURE);
  }

  // Validate target language is allowed
  const availableLanguages =
    featureConfig.feature.config?.availableLanguages || [];
  if (
    availableLanguages.length > 0 &&
    !availableLanguages.includes(targetLanguage)
  ) {
    throw new BadRequest(ERROR_CODES.TRANSLATION_TARGET_LANGUAGE_NOT_ALLOWED);
  }

  return featureConfig;
}

/**
 * Extract full context from mailing for translation
 * Used by DeepL to provide context for better translations
 * @param {Object} textsToTranslate - Extracted texts object
 * @returns {string} Concatenated context text
 */
function extractFullContext(textsToTranslate) {
  if (!textsToTranslate || typeof textsToTranslate !== 'object') {
    return '';
  }

  // Get all text values and join them
  const allTexts = Object.values(textsToTranslate)
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());

  // Join with double newlines for clear separation
  return allTexts.join('\n\n');
}

module.exports = { getTranslationFeature, extractFullContext };
