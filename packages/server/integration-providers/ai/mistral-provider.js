'use strict';

const fetch = require('node-fetch');
const BaseLLMProvider = require('./base-llm-provider');
const logger = require('../../utils/logger.js');

const DEFAULT_MODEL = 'mistral-small-latest';
const DEFAULT_API_HOST = 'https://api.mistral.ai';

/**
 * Mistral AI provider implementation
 *
 * Key difference from OpenAI: uses a flat-JSON-aware prompt to prevent
 * the model from converting dot-notation keys into nested objects
 * (e.g. "data.block.title" must stay as-is, not become { data: { block: { title } } }).
 */
class MistralProvider extends BaseLLMProvider {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  _getDefaultModel() {
    return DEFAULT_MODEL;
  }

  getStaticModels() {
    return [
      { id: 'mistral-small-latest', name: 'Mistral Small (fast)' },
      { id: 'mistral-medium-latest', name: 'Mistral Medium (balanced)' },
      { id: 'mistral-large-latest', name: 'Mistral Large (powerful)' },
    ];
  }

  async validateCredentials() {
    try {
      const response = await fetch(`${this.baseUrl}/v1/models`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
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
