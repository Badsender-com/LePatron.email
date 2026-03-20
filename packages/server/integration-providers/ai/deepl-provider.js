'use strict';

const deepl = require('deepl-node');
const BaseProvider = require('../base-provider.js');
const logger = require('../../utils/logger.js');
const {
  protectVariables,
  restoreVariables,
} = require('../../translation/variable-placeholder.utils.js');

/**
 * DeepL provider implementation
 *
 * Unlike LLM-based providers (OpenAI, Mistral), DeepL is a dedicated
 * translation service with different characteristics:
 * - Accepts arrays of strings, not JSON objects
 * - Has an explicit `context` parameter for translation context
 * - Does not understand variable syntax, so we use placeholders
 * - Supports formality settings
 */
class DeepLProvider extends BaseProvider {
  constructor(integration) {
    super(integration);

    // Get formality setting from feature config
    this.formality = this.config.formality || 'default';

    // Initialize DeepL client
    // The library automatically detects Free vs Pro based on API key
    this.client = new deepl.DeepLClient(this.apiKey, {
      maxRetries: 3,
      minTimeout: 5000,
    });
  }

  /**
   * Validate DeepL credentials by checking usage
   */
  async validateCredentials() {
    try {
      await this.client.getUsage();
      return true;
    } catch (error) {
      logger.error(`[DeepL] Validation error: ${error.message}`);
      return false;
    }
  }

  /**
   * Get DeepL usage statistics
   * @returns {Promise<Object>} Usage info
   */
  async getUsage() {
    const usage = await this.client.getUsage();
    return {
      characterCount: usage.character.count,
      characterLimit: usage.character.limit,
      limitReached: usage.character.limitReached(),
    };
  }

  /**
   * DeepL doesn't use models like LLMs - return null
   */
  getDefaultTranslationModel() {
    return null;
  }

  /**
   * DeepL doesn't have models to list
   */
  async getAvailableModels() {
    return [];
  }

  /**
   * Get available languages from DeepL
   */
  async getAvailableLanguages() {
    const [sourceLanguages, targetLanguages] = await Promise.all([
      this.client.getSourceLanguages(),
      this.client.getTargetLanguages(),
    ]);

    return {
      source: sourceLanguages.map((lang) => ({
        code: lang.code,
        name: lang.name,
      })),
      target: targetLanguages.map((lang) => ({
        code: lang.code,
        name: lang.name,
        supportsFormality: lang.supportsFormality || false,
      })),
    };
  }

  /**
   * Translate a batch of texts using DeepL
   *
   * @param {Object} params Translation parameters
   * @param {Object} params.texts Object with key-value pairs to translate
   * @param {string} params.sourceLanguage Source language code (or 'auto')
   * @param {string} params.targetLanguage Target language code
   * @param {string} [params.context] Additional context for translation
   * @returns {Promise<Object>} Translated texts with same keys
   */
  async translateBatch({ texts, sourceLanguage, targetLanguage, context }) {
    const keys = Object.keys(texts);
    const values = Object.values(texts);

    if (keys.length === 0) {
      return {};
    }

    logger.log(
      `[DeepL] Translating ${keys.length} texts from ${sourceLanguage} to ${targetLanguage}`
    );

    // 1. Protect variables in all texts
    const protectionResults = values.map((value) => protectVariables(value));
    const protectedTexts = protectionResults.map((r) => r.protectedText);
    const placeholderMaps = protectionResults.map((r) => r.placeholderMap);

    // 2. Call DeepL API
    const startTime = Date.now();
    const results = await this._callDeepL({
      texts: protectedTexts,
      sourceLanguage,
      targetLanguage,
      context,
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    logger.log(`[DeepL] Translation completed in ${elapsed}s`);

    // 3. Restore variables and rebuild object
    const translations = {};
    results.forEach((result, index) => {
      const restored = restoreVariables(result.text, placeholderMaps[index]);
      translations[keys[index]] = restored;
    });

    return translations;
  }

  /**
   * Translate a single text
   */
  async translateText({ text, sourceLanguage, targetLanguage, context }) {
    const result = await this.translateBatch({
      texts: { text },
      sourceLanguage,
      targetLanguage,
      context,
    });
    return result.text;
  }

  /**
   * Call DeepL translation API
   * @private
   */
  async _callDeepL({ texts, sourceLanguage, targetLanguage, context }) {
    try {
      // DeepL expects null for auto-detection
      // Source language must be base code only (no regional variants)
      const sourceLang =
        sourceLanguage === 'auto'
          ? null
          : this._normalizeSourceLanguage(sourceLanguage);

      // DeepL target language codes are uppercase (e.g., 'EN-US', 'FR')
      const targetLang = this._normalizeTargetLanguage(targetLanguage);

      // Build options
      const options = {
        preserveFormatting: true,
      };

      // Add context if provided (not translated, not billed)
      if (context) {
        options.context = context;
      }

      // Add formality if not default and language supports it
      if (this.formality && this.formality !== 'default') {
        options.formality = this.formality;
      }

      // Call DeepL
      const results = await this.client.translateText(
        texts,
        sourceLang,
        targetLang,
        options
      );

      // Ensure we always return an array
      return Array.isArray(results) ? results : [results];
    } catch (error) {
      logger.error(`[DeepL] API error: ${error.message}`);

      // Provide more specific error messages
      if (error.message.includes('Authorization')) {
        throw new Error('DeepL API key is invalid');
      }
      if (error.message.includes('Quota')) {
        throw new Error('DeepL quota exceeded');
      }

      throw error;
    }
  }

  /**
   * Normalize source language code for DeepL
   * DeepL source languages only accept base codes (no regional variants)
   * e.g., 'en-us' → 'EN', 'pt-br' → 'PT'
   * @private
   */
  _normalizeSourceLanguage(lang) {
    if (!lang) return lang;
    // Remove regional variant (e.g., 'en-us' → 'en', 'zh-hans' → 'zh')
    const baseLang = lang.split('-')[0];
    return baseLang.toUpperCase();
  }

  /**
   * Normalize target language code for DeepL
   * DeepL uses uppercase codes (e.g., 'FR', 'EN-US', 'ZH-HANS')
   * @private
   */
  _normalizeTargetLanguage(lang) {
    if (!lang) return lang;
    return lang.toUpperCase();
  }
}

module.exports = DeepLProvider;
