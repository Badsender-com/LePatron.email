'use strict';

module.exports = {
  // Dashboard providers
  METABASE: 'metabase',
  // AI providers
  OPENAI: 'openai',
  MISTRAL: 'mistral',
  INFOMANIAK: 'infomaniak',
  ANTHROPIC: 'anthropic',
  GEMINI: 'gemini',
  AZURE_OPENAI: 'azure_openai',
  // Any endpoint speaking the OpenAI contract: OpenRouter, Groq, vLLM, an
  // in-house gateway.
  OPENAI_COMPATIBLE: 'openai_compatible',
  SCALEWAY: 'scaleway',
  OVH: 'ovh',
  DEEPL: 'deepl',
  // Data feed providers
  RSS: 'rss',
  // Future providers
  // SMARTCAT: 'smartcat',
  // LOOKER: 'looker',
  // TABLEAU: 'tableau',
  // POWERBI: 'powerbi',
};
