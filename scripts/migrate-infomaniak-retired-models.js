#!/usr/bin/env node
'use strict';

/**
 * Migration: clear the Infomaniak models that no longer exist.
 *
 * Four of the aliases the catalogue used to offer — mixtral, llama3, granite,
 * gemma3n — now answer 422 on Infomaniak's chat API (verified against a live
 * account). The catalogue no longer offers them and `mixtral`, the default,
 * was replaced; but a group that picked one explicitly still sends it on
 * every call, and every call fails.
 *
 * Resets `features[].config.model` to null, so these features fall back to
 * the provider default (mistral3 today). Null rather than a hand-picked
 * replacement: none of the four has a true equivalent, and the default is the
 * model this change verified.
 *
 * Only on features pointing at an Infomaniak integration: the same id on an
 * OpenAI-compatible endpoint may be perfectly valid there.
 *
 * Idempotent — a re-run finds nothing once the models are cleared.
 *
 * Usage:
 *   node scripts/migrate-infomaniak-retired-models.js              # apply
 *   node scripts/migrate-infomaniak-retired-models.js --dry-run    # report only
 */

const path = require('path');
const mongoose = require('mongoose');

require('dotenv').config();
const config = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'node.config.js'
));
const { Integrations, AIFeatureConfigs } = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'common',
  'models.common.js'
));

const DRY = process.argv.includes('--dry-run');

const RETIRED_MODELS = Object.freeze([
  'mixtral',
  'llama3',
  'granite',
  'gemma3n',
]);

/**
 * The model fields to reset in one AIFeatureConfig document.
 *
 * @param {Object} doc raw AIFeatureConfig document
 * @param {Array} infomaniakIntegrationIds ids of every Infomaniak integration
 * @returns {Array<{path: string, featureType: string, from: string}>}
 */
function planFeatureConfigMigration(doc, infomaniakIntegrationIds) {
  const infomaniakIds = new Set(infomaniakIntegrationIds.map(String));
  const resets = [];

  (doc.features || []).forEach((feature, index) => {
    if (!feature || !feature.integration) return;
    if (!infomaniakIds.has(String(feature.integration))) return;

    const model = feature.config && feature.config.model;
    if (!RETIRED_MODELS.includes(model)) return;

    resets.push({
      path: `features.${index}.config.model`,
      featureType: feature.featureType,
      from: model,
    });
  });

  return resets;
}

async function main() {
  console.log(`Connecting to ${config.database} (dry-run=${DRY})…`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  try {
    // Raw collection access: a model read runs the encryption plugin's hooks,
    // which have no business in a migration that never touches the key.
    const infomaniakIds = await Integrations.collection.distinct('_id', {
      provider: 'infomaniak',
    });
    if (infomaniakIds.length === 0) {
      console.log('No Infomaniak integration: nothing to do.');
      return;
    }

    const docs = await AIFeatureConfigs.collection
      .find(
        {
          features: {
            $elemMatch: {
              integration: { $in: infomaniakIds },
              'config.model': { $in: RETIRED_MODELS },
            },
          },
        },
        { projection: { _id: 1, _company: 1, features: 1 } }
      )
      .toArray();

    let cleared = 0;
    for (const doc of docs) {
      const resets = planFeatureConfigMigration(doc, infomaniakIds);
      if (resets.length === 0) continue;

      for (const { featureType, from } of resets) {
        console.log(
          `  group ${doc._company}: ${featureType} ${from} → provider default`
        );
      }
      cleared += resets.length;
      if (DRY) continue;

      const $set = {};
      for (const { path: fieldPath } of resets) $set[fieldPath] = null;
      await AIFeatureConfigs.collection.updateOne({ _id: doc._id }, { $set });
    }

    console.log(
      `Infomaniak retired models: ${cleared} feature(s) ${
        DRY ? 'would be reset' : 'reset'
      } to the provider default.`
    );
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { planFeatureConfigMigration, RETIRED_MODELS };
