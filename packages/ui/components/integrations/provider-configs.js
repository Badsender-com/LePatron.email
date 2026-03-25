/**
 * Provider form configurations for the integration form.
 *
 * Each provider defines its UI-specific metadata (placeholders, hints, required fields).
 * To add a new provider, simply add a new entry with a function receiving the $t i18n helper.
 */

export const providerConfigs = {
  openai: ($t) => ({
    apiKeyPlaceholder: 'sk-...',
    apiHostPlaceholder: 'https://api.openai.com',
    apiHostHint: $t('integrations.openai.apiHostHint'),
    showProductId: false,
  }),

  mistral: ($t) => ({
    apiKeyPlaceholder: 'your-mistral-api-key',
    apiHostPlaceholder: 'https://api.mistral.ai',
    apiHostHint: $t('integrations.mistral.apiHostHint'),
    showProductId: false,
  }),

  infomaniak: ($t) => ({
    apiKeyPlaceholder: 'your-infomaniak-api-key',
    apiHostPlaceholder: '',
    apiHostHint: '',
    showProductId: true,
    productIdHint: $t('integrations.infomaniak.productIdHint'),
  }),

  deepl: () => ({
    apiKeyPlaceholder: 'your-deepl-api-key',
    apiHostPlaceholder: '',
    apiHostHint: '',
    showProductId: false,
  }),
};

/**
 * Returns the form config for a given provider.
 * @param {string} provider - Provider identifier
 * @param {Function} $t - i18n translation function
 * @returns {Object} Provider form config or empty object if unknown
 */
export function getProviderFormConfig(provider, $t) {
  const configFn = providerConfigs[provider];
  return configFn ? configFn($t) : {};
}

/**
 * Provider display labels.
 */
export const providerLabels = {
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
