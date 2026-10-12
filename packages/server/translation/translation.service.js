'use strict';

const createError = require('http-errors');
const { BadRequest } = createError;
const ERROR_CODES = require('../constant/error-codes.js');
const { ProviderError } = require('../integration-providers/provider-error.js');
const AIFeatureTypes = require('../constant/ai-feature-type.js');
const logger = require('../utils/logger.js');
const aiFeatureService = require('../ai-feature/ai-feature.service.js');
const ProviderFactory = require('../integration-providers/provider-factory.js');
const {
  getTranslationFeature,
  extractFullContext,
} = require('./translation-feature.js');
const { translateMailing } = require('./mailing-translation.js');

module.exports = {
  translateMailing,
  translateText,
  translateBlockContent,
  getAvailableLanguages,
  detectSourceLanguage,
  extractFullContext,
};

/**
 * Translate a single text (for inline/field-by-field translation)
 * @param {Object} params
 * @param {string} params.groupId - Group ID
 * @param {string} params.text - Text to translate
 * @param {string} params.sourceLanguage - Source language code (or 'auto')
 * @param {string} params.targetLanguage - Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateText({
  groupId,
  text,
  sourceLanguage,
  targetLanguage,
}) {
  const { integration, feature } = await getTranslationFeature({
    groupId,
    targetLanguage,
  });

  // Create provider with feature config (includes model selection)
  const providerConfig = feature.config || {};
  const provider = ProviderFactory.createProvider(integration, providerConfig);

  try {
    return await provider.translateText({
      text,
      sourceLanguage,
      targetLanguage,
    });
  } catch (error) {
    logger.error(`[Translation] Translation error: ${error.message}`);
    const status = error instanceof ProviderError ? error.httpStatus : 400;
    throw createError(
      status,
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }
}

/**
 * Translate block content (for block-level translation in editor)
 * Block content is already extracted on client side as a flat object
 * @param {Object} params
 * @param {string} params.groupId - Group ID
 * @param {Object} params.blockContent - Block content to translate (flat object with text fields)
 * @param {string} params.sourceLanguage - Source language code (or 'auto')
 * @param {string} params.targetLanguage - Target language code
 * @returns {Promise<Object>} Translated block content
 */
async function translateBlockContent({
  groupId,
  blockContent,
  sourceLanguage,
  targetLanguage,
}) {
  const { integration, feature } = await getTranslationFeature({
    groupId,
    targetLanguage,
  });

  // blockContent is already extracted on client side (flat object)
  // No need to extract again - just validate it has content
  if (!blockContent || typeof blockContent !== 'object') {
    throw new BadRequest(ERROR_CODES.TRANSLATION_INVALID_BLOCK_CONTENT);
  }

  if (Object.keys(blockContent).length === 0) {
    // Nothing to translate
    return blockContent;
  }

  // Create provider with feature config (includes model selection)
  const providerConfig = feature.config || {};
  const provider = ProviderFactory.createProvider(integration, providerConfig);

  // Extract full context for DeepL (improves translation quality)
  // LLM providers will ignore this parameter
  const context = extractFullContext(blockContent);

  try {
    // Use translateBatch for consistency with mailing translation
    const translations = await provider.translateBatch({
      texts: blockContent,
      sourceLanguage,
      targetLanguage,
      context,
    });

    return translations;
  } catch (error) {
    logger.error(`[Translation] Block translation error: ${error.message}`);
    const status = error instanceof ProviderError ? error.httpStatus : 400;
    throw createError(
      status,
      ERROR_CODES.TRANSLATION_PROVIDER_ERROR + ': ' + error.message
    );
  }
}

/**
 * Get available languages for a group
 * @param {string} groupId - Group ID
 * @returns {Promise<Object>} Available languages configuration
 */
async function getAvailableLanguages({ groupId }) {
  const featureConfig = await aiFeatureService.getActiveFeatureWithIntegration({
    groupId,
    featureType: AIFeatureTypes.TRANSLATION,
  });

  if (!featureConfig) {
    return {
      isAvailable: false,
      languages: [],
      defaultSourceLanguage: 'auto',
    };
  }

  const { feature } = featureConfig;

  return {
    isAvailable: true,
    languages: feature.config?.availableLanguages || [],
    defaultSourceLanguage: feature.config?.defaultSourceLanguage || 'auto',
  };
}

/**
 * Detect source language from mailing HTML preview
 * @param {Object} mailing - Mailing document
 * @returns {string} Detected language code or 'auto'
 */
function detectSourceLanguage(mailing) {
  // Try to extract lang attribute from previewHtml
  if (mailing.previewHtml) {
    const langMatch = mailing.previewHtml.match(
      /<html[^>]*\slang=["']([a-z]{2})["']/i
    );
    if (langMatch) {
      return langMatch[1].toLowerCase();
    }
  }

  // Fallback to auto-detect
  return 'auto';
}
