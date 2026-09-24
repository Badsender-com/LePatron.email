'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');
const {
  guardedFetch,
  fetchProviderJson,
  LISTING_TIMEOUT_MS,
} = require('../provider-http.js');

const DEFAULT_API_HOST = 'https://api.openai.com';

/**
 * OpenAI provider implementation
 */
class OpenAIProvider extends BaseLLMProvider {
  // OpenAI-compatible JSON mode: guarantees syntactically valid JSON output.
  supportsJsonResponseFormat() {
    return true;
  }

  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  /**
   * OpenAI lists every model family at once — embeddings, TTS, whisper, image
   * and moderation models alongside the chat ones — with no field saying
   * which is which. The noise filter lives in the catalogue rather than here,
   * so the rules sit next to the curated entries they defer to.
   */
  async listRemoteModels() {
    const payload = await fetchProviderJson(`${this.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      label: 'OpenAI models listing',
    });
    // `shutdown_date` is OpenAI telling us when a model goes away. It is the
    // only usable metadata here — the listing carries no description and no
    // pricing — and it saves us from curating a list of dead models by hand.
    return (payload.data || []).map((model) => ({
      id: model.id,
      shutdownDate: model.shutdown_date || null,
    }));
  }

  async validateCredentials() {
    try {
      const response = await guardedFetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeoutMs: LISTING_TIMEOUT_MS,
        label: 'OpenAI credentials check',
      });

      return response.ok;
    } catch (error) {
      logger.error('OpenAI validation error:', error.message);
      return false;
    }
  }
}

module.exports = OpenAIProvider;
