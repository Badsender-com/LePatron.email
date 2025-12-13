'use strict';

const BaseProvider = require('../base-provider');

/**
 * Interface for AI providers (OpenAI, Mistral, etc.)
 * All AI providers must implement these methods
 */
class AIProviderInterface extends BaseProvider {
  /**
   * Translate a batch of texts
   * @param {Object} params Translation parameters
   * @param {Object} params.texts Object with key-value pairs to translate
   * @param {string} params.sourceLanguage Source language code (or 'auto')
   * @param {string} params.targetLanguage Target language code
   * @returns {Promise<Object>} Translated texts with same keys
   */
  // eslint-disable-next-line no-unused-vars
  async translateBatch({ texts, sourceLanguage, targetLanguage }) {
    throw new Error('Method translateBatch() must be implemented');
  }

  /**
   * Translate a single text
   * @param {Object} params Translation parameters
   * @param {string} params.text Text to translate
   * @param {string} params.sourceLanguage Source language code (or 'auto')
   * @param {string} params.targetLanguage Target language code
   * @returns {Promise<string>} Translated text
   */
  // eslint-disable-next-line no-unused-vars
  async translateText({ text, sourceLanguage, targetLanguage }) {
    throw new Error('Method translateText() must be implemented');
  }

  /**
   * Get the default model for translation
   * @returns {string} Model identifier
   */
  getDefaultTranslationModel() {
    throw new Error('Method getDefaultTranslationModel() must be implemented');
  }
}

module.exports = AIProviderInterface;
