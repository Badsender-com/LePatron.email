'use strict';

const path = require('path');

const resolveServer = (...parts) =>
  require(path.resolve(__dirname, '..', '..', 'packages', 'server', ...parts));

const { Integrations, AIFeatureConfigs } = resolveServer(
  'common',
  'models.common.js'
);
const { getCatalogModels } = resolveServer(
  'integration-providers',
  'ai',
  'model-catalog.js'
);
const modelListing = resolveServer(
  'integration-providers',
  'ai',
  'model-listing.service.js'
);

const { selectModels } = require('./plan.js');

/**
 * Working out what to probe: reads the integrations, asks each provider what
 * it currently lists, and hands the pure selector the three sets it needs.
 *
 * Split from the CLI so the entry point stays readable, and because this is
 * the only part that touches Mongo.
 */

// Providers that do not answer chat completions.
const NON_LLM = new Set(['deepl', 'rss', 'metabase']);

const KNOWN_LLM_PROVIDERS = [
  'openai',
  'mistral',
  'infomaniak',
  'anthropic',
  'gemini',
  'azure_openai',
  'openai_compatible',
  'scaleway',
  'ovh',
];

/** Models a group actually configured — where a breakage is live today. */
async function configuredModels(integrationIds) {
  const configs = await AIFeatureConfigs.find({
    'features.integration': { $in: integrationIds },
  }).lean();

  const models = new Set();
  for (const config of configs) {
    for (const feature of config.features || []) {
      if (!feature.integration) continue;
      if (
        !integrationIds.some((id) => String(id) === String(feature.integration))
      )
        continue;
      if (feature.config && feature.config.model)
        models.add(feature.config.model);
    }
  }
  return [...models];
}

async function buildPlan(options) {
  const query = { type: 'ai', isActive: true };
  if (options.providers) query.provider = { $in: options.providers };

  // Through the model, never .collection: the encryption plugin's post-find
  // hook is what decrypts apiKey.
  const integrations = (await Integrations.find(query)).filter(
    (integration) => !NON_LLM.has(integration.provider)
  );

  const plan = [];
  for (const integration of integrations) {
    const listing = await modelListing.listModelsForIntegration(integration);
    const configured = await configuredModels([integration._id]);

    plan.push({
      integration,
      models: selectModels({
        catalogIds: getCatalogModels(integration.provider).map((m) => m.id),
        configuredIds: configured,
        listedIds: listing.models.map((m) => m.id),
        all: options.all,
        only: options.models,
      }),
      listingError: listing.error || null,
    });
  }
  return plan;
}

/** Providers with no active integration here, so nothing could be probed. */
function uncoveredProviders(plan) {
  const covered = new Set(plan.map((entry) => entry.integration.provider));
  return KNOWN_LLM_PROVIDERS.filter((provider) => !covered.has(provider));
}

module.exports = {
  buildPlan,
  uncoveredProviders,
  NON_LLM,
  KNOWN_LLM_PROVIDERS,
};
