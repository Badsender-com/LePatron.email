/**
 * Provider form configurations for the integration form.
 *
 * Each provider defines its UI-specific metadata (required fields, feature flags).
 * All user-facing strings use i18n keys resolved by the component template.
 */

/**
 * Provider categories for grouping in UI.
 */
export const providerCategories = {
  bi: {
    key: 'bi',
    labelKey: 'integrations.categories.bi',
    icon: 'mdi-chart-bar',
    order: 1,
  },
  aiGeneration: {
    key: 'aiGeneration',
    labelKey: 'integrations.categories.aiGeneration',
    icon: 'mdi-robot',
    order: 2,
  },
  aiTranslation: {
    key: 'aiTranslation',
    labelKey: 'integrations.categories.aiTranslation',
    icon: 'mdi-translate',
    order: 3,
  },
};

/**
 * Provider configurations with category assignment.
 */
export const providerConfigs = {
  // BI & Analytics providers
  metabase: {
    category: 'bi',
    type: 'dashboard',
    apiKeyPlaceholderKey: 'integrations.metabase.apiKeyPlaceholder',
    apiKeyLabelKey: 'integrations.metabase.apiKeyLabel',
    apiHostPlaceholder: 'https://metabase.example.com',
    apiHostHintKey: 'integrations.metabase.apiHostHint',
    apiHostRequired: true,
    showProductId: false,
  },

  // AI - Content generation providers
  openai: {
    category: 'aiGeneration',
    type: 'ai',
    apiKeyPlaceholderKey: 'integrations.openai.apiKeyPlaceholder',
    apiHostPlaceholder: 'https://api.openai.com',
    apiHostHintKey: 'integrations.openai.apiHostHint',
    showProductId: false,
  },

  mistral: {
    category: 'aiGeneration',
    type: 'ai',
    apiKeyPlaceholderKey: 'integrations.mistral.apiKeyPlaceholder',
    apiHostPlaceholder: 'https://api.mistral.ai',
    apiHostHintKey: 'integrations.mistral.apiHostHint',
    showProductId: false,
  },

  infomaniak: {
    category: 'aiGeneration',
    type: 'ai',
    apiKeyPlaceholderKey: 'integrations.infomaniak.apiKeyPlaceholder',
    apiHostPlaceholder: '',
    apiHostHintKey: '',
    showProductId: true,
    productIdHintKey: 'integrations.infomaniak.productIdHint',
  },

  // AI - Translation providers
  deepl: {
    category: 'aiTranslation',
    type: 'ai',
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
  // BI & Analytics
  metabase: 'Metabase',
  // AI - Generation
  openai: 'OpenAI',
  mistral: 'Mistral AI',
  infomaniak: 'Infomaniak AI Tools',
  // AI - Translation
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

/**
 * Returns the category config for a given provider.
 * @param {string} provider - Provider identifier
 * @returns {Object} Category config or null if unknown
 */
export function getProviderCategory(provider) {
  const config = providerConfigs[provider];
  if (!config || !config.category) return null;
  return providerCategories[config.category] || null;
}

/**
 * Returns providers grouped by category for use in grouped selects.
 * @param {string[]} providerKeys - List of provider keys to include
 * @returns {Array} Array of { category, providers } objects sorted by category order
 */
export function getProvidersGroupedByCategory(providerKeys) {
  const groups = {};

  for (const key of providerKeys) {
    const config = providerConfigs[key];
    if (!config) continue;

    const categoryKey = config.category || 'other';
    if (!groups[categoryKey]) {
      groups[categoryKey] = {
        category: providerCategories[categoryKey] || { key: 'other', order: 99 },
        providers: [],
      };
    }
    groups[categoryKey].providers.push({
      key,
      label: providerLabels[key] || key,
      config,
    });
  }

  // Sort by category order
  return Object.values(groups).sort((a, b) => a.category.order - b.category.order);
}
