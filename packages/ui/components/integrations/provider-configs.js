/**
 * Provider form configurations for the integration form.
 *
 * Each provider defines its UI-specific metadata (required fields, feature flags).
 * All user-facing strings use i18n keys resolved by the component template.
 */

export const providerConfigs = {
  // Dashboard providers
  metabase: {
    type: 'dashboard',
    apiKeyPlaceholderKey: 'integrations.metabase.apiKeyPlaceholder',
    apiKeyLabelKey: 'integrations.metabase.apiKeyLabel',
    apiHostPlaceholder: 'https://metabase.example.com',
    apiHostHintKey: 'integrations.metabase.apiHostHint',
    apiHostRequired: true,
    showProductId: false,
  },

  // AI providers
  openai: {
    apiKeyPlaceholderKey: 'integrations.openai.apiKeyPlaceholder',
    apiHostPlaceholder: 'https://api.openai.com',
    apiHostHintKey: 'integrations.openai.apiHostHint',
    showProductId: false,
  },

  mistral: {
    apiKeyPlaceholderKey: 'integrations.mistral.apiKeyPlaceholder',
    apiHostPlaceholder: 'https://api.mistral.ai',
    apiHostHintKey: 'integrations.mistral.apiHostHint',
    showProductId: false,
  },

  infomaniak: {
    apiKeyPlaceholderKey: 'integrations.infomaniak.apiKeyPlaceholder',
    apiHostPlaceholder: '',
    apiHostHintKey: '',
    showProductId: true,
    productIdHintKey: 'integrations.infomaniak.productIdHint',
  },

  deepl: {
    apiKeyPlaceholderKey: 'integrations.deepl.apiKeyPlaceholder',
    apiHostPlaceholder: '',
    apiHostHintKey: '',
    showProductId: false,
  },
};

/**
 * Returns the raw form config for a given provider (no i18n resolution).
 * @param {string} provider - Provider identifier
 * @returns {Object} Provider form config or empty object if unknown
 */
export function getProviderFormConfig(provider) {
  return providerConfigs[provider] || {};
}

/**
 * Provider display labels.
 */
export const providerLabels = {
  // Dashboard providers
  metabase: 'Metabase',
  // AI providers
  openai: 'OpenAI',
  mistral: 'Mistral AI',
  infomaniak: 'Infomaniak AI Tools',
  deepl: 'DeepL',
};

/**
 * Returns the display label for a given provider.
 * @param {string} provider - Provider identifier
 * @returns {string}
 */
export function getProviderLabel(provider) {
  return providerLabels[provider] || provider;
}
