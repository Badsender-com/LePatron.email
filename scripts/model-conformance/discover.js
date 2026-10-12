'use strict';

const path = require('path');

const resolveServer = (...parts) =>
  require(path.resolve(__dirname, '..', '..', 'packages', 'server', ...parts));

const { Integrations, AIFeatureConfigs, Groups } = resolveServer(
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

const { selectModels, dedupeIntegrations } = require('./plan.js');

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

/**
 * Whose keys a run may spend on.
 *
 * The platform group's by default: a run against production would otherwise
 * bill every client's OpenAI or Anthropic account for our own tests. Anything
 * beyond takes an explicit `--integration=<id>`, which is a decision someone
 * made, not a default they forgot.
 *
 * @returns {Promise<{query: Object, scope: string}>}
 */
async function integrationScope(options) {
  const query = { type: 'ai', isActive: true };
  if (options.providers) query.provider = { $in: options.providers };

  if (options.integrations) {
    query._id = { $in: options.integrations };
    return {
      query,
      scope: `integration(s) ${options.integrations.join(', ')}`,
    };
  }

  const platform = await Groups.findOne(
    { isPlatform: true },
    { _id: 1, name: 1 }
  ).lean();
  if (!platform) {
    throw new Error(
      'No platform group: run `yarn flag-platform-group` and configure its AI ' +
        'integrations, or name the integrations to probe with --integration=<id>.'
    );
  }
  query._company = platform._id;
  return { query, scope: `platform group "${platform.name}"` };
}

async function buildPlan(options) {
  const { query, scope } = await integrationScope(options);

  // Through the model, never .collection: the encryption plugin's post-find
  // hook is what decrypts apiKey. Sorted so that which duplicate wins is the
  // same on every run.
  const found = (await Integrations.find(query).sort({ _id: 1 })).filter(
    (integration) => !NON_LLM.has(integration.provider)
  );
  const { kept, duplicates } = dedupeIntegrations(found);

  const plan = [];
  for (const integration of kept) {
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
  return { plan, scope, duplicates };
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
