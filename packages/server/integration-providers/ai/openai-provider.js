'use strict';

const fetch = require('node-fetch');
const BaseLLMProvider = require('./base-llm-provider');

const DEFAULT_MODEL = 'gpt-4o-mini';
const DEFAULT_API_HOST = 'https://api.openai.com';

/**
 * OpenAI provider implementation
 */
class OpenAIProvider extends BaseLLMProvider {
  constructor(integration) {
    super(integration);
    this.baseUrl = this.apiHost || DEFAULT_API_HOST;
  }

  _getDefaultModel() {
    return DEFAULT_MODEL;
  }

  getStaticModels() {
    return [
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini (fast, economical)' },
      { id: 'gpt-4o', name: 'GPT-4o (balanced)' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo (powerful)' },
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
      console.error('OpenAI validation error:', error.message);
      return false;
    }
  }
}

module.exports = OpenAIProvider;
