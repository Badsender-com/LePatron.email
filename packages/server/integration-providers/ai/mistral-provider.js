'use strict';

const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');
const {
  guardedFetch,
  fetchProviderJson,
  LISTING_TIMEOUT_MS,
} = require('../provider-http.js');

const DEFAULT_API_HOST = 'https://api.mistral.ai';

/**
 * Mistral AI provider implementation
 *
 * Key difference from OpenAI: uses a flat-JSON-aware prompt to prevent
 * the model from converting dot-notation keys into nested objects
 * (e.g. "data.block.title" must stay as-is, not become { data: { block: { title } } }).
 */
class MistralProvider extends BaseLLMProvider {
  // OpenAI-compatible JSON mode: guarantees syntactically valid JSON output.
  supportsJsonResponseFormat() {
    return true;
  }

  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  /**
   * Unlike OpenAI, Mistral tags each model with its capabilities, so the chat
   * models can be told apart at the source and no pattern matching is needed
   * downstream.
   */
  async listRemoteModels() {
    const payload = await fetchProviderJson(`${this.baseUrl}/v1/models`, {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      label: 'Mistral models listing',
    });
    // Mistral is the richest of the three listings: it carries a written
    // description, a deprecation date and the model meant to replace it.
    return (payload.data || [])
      .filter((model) => model.capabilities?.completion_chat)
      .map((model) => ({
        id: model.id,
        label: model.name,
        description: model.description || null,
        shutdownDate: model.deprecation || null,
        replacedBy: model.deprecation_replacement_model || null,
      }));
  }

  async validateCredentials() {
    try {
      const response = await guardedFetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${this.apiKey}` },
        timeoutMs: LISTING_TIMEOUT_MS,
        label: 'Mistral credentials check',
      });

      return response.ok;
    } catch (error) {
      logger.error('Mistral validation error:', error.message);
      return false;
    }
  }

  _buildTranslationPrompt({ texts, sourceDesc, targetLanguage }) {
    const inputJson = JSON.stringify(texts, null, 2);
    logger.log(
      'Translation input - keys count:',
      Object.keys(texts).length,
      '- size:',
      inputJson.length,
      'chars'
    );

    return `Translate the following JSON object values from ${sourceDesc} to ${targetLanguage}.

CRITICAL RULES:
1. Return ONLY a valid JSON object - no markdown, no explanation
2. The output MUST be a FLAT object with the EXACT SAME KEYS as the input
3. Keys contain dots like "data.headerBlock.titleText" - these are NOT nested objects, they are literal string keys with dots in them
4. DO NOT restructure, nest, or reorganize the JSON - keep it flat
5. Translate only the values, never modify the keys
6. Preserve all dynamic variables exactly: %%VAR%%, {{var}}, <%=var%>, @[var]
7. Do not translate URLs or email addresses

Example - if input is:
{"data.block.title": "Bonjour"}

Output MUST be:
{"data.block.title": "Hello"}

NOT this (wrong - nested structure):
{"data": {"block": {"title": "Hello"}}}

INPUT JSON:
${inputJson}

OUTPUT (flat JSON with exact same keys):`;
  }

  _getSystemPrompt() {
    return 'You are a JSON translation API. You receive a FLAT JSON object with dot-notation keys like "data.block.title" and return the EXACT same flat structure with translated values. NEVER convert flat keys to nested objects. Return valid JSON only, no markdown.';
  }
}

module.exports = MistralProvider;
