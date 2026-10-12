'use strict';

const {
  planFeatureConfigMigration,
  RETIRED_MODELS,
} = require('../../scripts/migrate-infomaniak-retired-models');
const {
  getCatalogModels,
} = require('../../packages/server/integration-providers/ai/model-catalog');

const INFOMANIAK_ID = 'infomaniak-integration';
const OPENAI_COMPATIBLE_ID = 'other-integration';

function config(...features) {
  return { _id: 'config-1', _company: 'group-1', features };
}

function feature(featureType, integration, model) {
  return { featureType, integration, config: { model } };
}

describe('migrate-infomaniak-retired-models.planFeatureConfigMigration', () => {
  it('resets a retired model on an Infomaniak feature', () => {
    const doc = config(feature('translation', INFOMANIAK_ID, 'mixtral'));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toEqual([
      {
        path: 'features.0.config.model',
        featureType: 'translation',
        from: 'mixtral',
      },
    ]);
  });

  it('resets every affected feature of the document, at its own index', () => {
    const doc = config(
      feature('translation', INFOMANIAK_ID, 'llama3'),
      feature('skill', INFOMANIAK_ID, 'gemma3n')
    );

    expect(
      planFeatureConfigMigration(doc, [INFOMANIAK_ID]).map((r) => r.path)
    ).toEqual(['features.0.config.model', 'features.1.config.model']);
  });

  // The same id may be valid on a self-hosted OpenAI-compatible endpoint.
  it('leaves the same id alone on another provider', () => {
    const doc = config(feature('skill', OPENAI_COMPATIBLE_ID, 'mixtral'));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toEqual([]);
  });

  it('leaves a model that still exists alone', () => {
    const doc = config(feature('skill', INFOMANIAK_ID, 'mistral3'));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toEqual([]);
  });

  // Idempotence: a re-run finds the fields already cleared.
  it('leaves a cleared model alone', () => {
    const doc = config(feature('skill', INFOMANIAK_ID, null));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toEqual([]);
  });

  it('compares ids as strings (ObjectId on one side, string on the other)', () => {
    const objectIdLike = { toString: () => INFOMANIAK_ID };
    const doc = config(feature('skill', objectIdLike, 'granite'));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toHaveLength(1);
  });

  it('skips a feature with no integration', () => {
    const doc = config(feature('skill', null, 'mixtral'));

    expect(planFeatureConfigMigration(doc, [INFOMANIAK_ID])).toEqual([]);
  });

  // Keeps the script and the catalogue telling the same story.
  it('never clears a model the catalogue still offers', () => {
    const offered = getCatalogModels('infomaniak').map((m) => m.id);

    expect(RETIRED_MODELS.filter((id) => offered.includes(id))).toEqual([]);
  });
});
