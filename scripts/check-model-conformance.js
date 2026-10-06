#!/usr/bin/env node
'use strict';

/**
 * Probe every model the picker can offer, on both code paths, against the
 * real providers.
 *
 * Why this exists: the model list is fetched live, so the picker offers models
 * whose request contract nobody here has ever seen. `gpt-6-astra` reached
 * staging and failed on a parameter name. The runtime adaptation layer now
 * recovers from that, but only this script can tell us *which* models need it,
 * and which ones fail for a reason nothing can recover from.
 *
 * Both paths are probed because they do not send the same request: the skill
 * path carries an output schema and usually no temperature, translation always
 * sends a temperature and never a token cap. A model can pass one and fail the
 * other.
 *
 * NOT a CI job. It spends real money on real keys, takes minutes, and depends
 * on providers that occasionally answer differently to the same call. Run it
 * before a release touching the AI integration, when adding a provider or a
 * model, and when a provider announces a new generation.
 *
 * It reads the integrations of whatever database it is pointed at — so it uses
 * that environment's keys. Check where you are before running it without
 * --dry. Only the platform group's integrations are probed unless others are
 * named with --integration: a client's key is the client's money.
 *
 * Usage:
 *   node scripts/check-model-conformance.js --dry          # plan and cost only
 *   node scripts/check-model-conformance.js --provider=openai
 *   node scripts/check-model-conformance.js --model=gpt-6-astra
 *   node scripts/check-model-conformance.js --all --max-calls=400
 *   node scripts/check-model-conformance.js --integration=<id>   # beyond the platform group
 *
 * Exit codes:
 *   0  every probe conformant
 *   1  at least one structural refusal
 *   2  warnings only (adapted, flaky, transient, skipped)
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
const BaseLLMProvider = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'integration-providers',
  'ai',
  'base-llm-provider.js'
));
const ProviderFactory = require(path.resolve(
  __dirname,
  '..',
  'packages',
  'server',
  'integration-providers',
  'provider-factory.js'
));

const { estimateCalls } = require('./model-conformance/plan.js');
const {
  buildPlan,
  uncoveredProviders,
} = require('./model-conformance/discover.js');
const { runProbe } = require('./model-conformance/probe.js');
const { meterChatCalls } = require('./model-conformance/meter.js');
const {
  formatReport,
  exitCodeFor,
  VERDICTS,
  PREFIX,
} = require('./model-conformance/report.js');

function parseArgs(argv) {
  const args = argv.slice(2);
  const value = (name) => {
    const found = args.find((a) => a.startsWith(`--${name}=`));
    return found ? found.slice(name.length + 3) : null;
  };
  const list = (name) => {
    const raw = value(name);
    return raw
      ? raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : null;
  };

  return {
    dry: args.includes('--dry'),
    all: args.includes('--all'),
    providers: list('provider'),
    integrations: list('integration'),
    models: list('model'),
    paths: list('path') || ['skill', 'translation'],
    samples: Number(value('samples') || 1),
    retries: Number(value('retries') || 2),
    maxCalls: Number(value('max-calls') || 400),
  };
}

async function main() {
  const options = parseArgs(process.argv);

  console.log(`${PREFIX} connecting to ${config.database}`);
  await mongoose.connect(config.database, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    const { plan, scope, duplicates } = await buildPlan(options);
    const calls = estimateCalls(plan, options.paths.length, options.samples);

    console.log(`${PREFIX} scope: ${scope}`);
    // A lower bound: retries, adaptation replays and translation batches all
    // add to it. The cap below is what actually bounds the spend.
    console.log(
      `${PREFIX} ${plan.length} integration(s), at least ${calls} call(s) planned`
    );
    for (const entry of plan) {
      console.log(
        `  ${entry.integration.provider}: ${entry.models.length} model(s)` +
          (entry.listingError
            ? ` (listing degraded: ${entry.listingError})`
            : '')
      );
    }
    if (duplicates.length) {
      console.log(
        `${PREFIX} skipped ${duplicates.length} integration(s) on an endpoint already in the plan`
      );
    }
    const uncovered = uncoveredProviders(plan);
    if (uncovered.length) {
      console.log(
        `${PREFIX} not covered (no active integration in scope): ${uncovered.join(
          ', '
        )}`
      );
    }

    if (options.dry) {
      console.log(`${PREFIX} --dry: nothing called.`);
      return 0;
    }

    if (calls > options.maxCalls) {
      console.error(
        `${PREFIX} ${calls} calls exceeds --max-calls=${options.maxCalls}. Narrow with --provider/--model, or raise the cap.`
      );
      return 1;
    }

    const results = [];
    const meter = meterChatCalls(BaseLLMProvider, options.maxCalls);

    for (const entry of plan) {
      const { integration } = entry;
      let provider;
      try {
        provider = ProviderFactory.createProvider(integration);
      } catch (error) {
        console.error(
          `${PREFIX} ${integration.provider}: cannot build provider — ${error.message}`
        );
        continue;
      }

      // One cheap call before spending on probes: a dead key would otherwise
      // read as every model being broken.
      if (!(await provider.validateCredentials())) {
        for (const model of entry.models) {
          for (const pathName of options.paths) {
            results.push({
              provider: integration.provider,
              integrationId: String(integration._id),
              model,
              path: pathName,
              verdict: VERDICTS.SKIPPED,
              detail: 'credentials rejected',
            });
          }
        }
        continue;
      }

      for (const model of entry.models) {
        for (const pathName of options.paths) {
          if (meter.calls >= options.maxCalls) {
            results.push({
              provider: integration.provider,
              integrationId: String(integration._id),
              model,
              path: pathName,
              verdict: VERDICTS.SKIPPED,
              detail: 'call cap reached',
            });
            continue;
          }

          const outcome = await runProbe({
            provider,
            integration,
            model,
            pathName,
            samples: options.samples,
            retries: options.retries,
          });
          results.push({
            provider: integration.provider,
            integrationId: String(integration._id),
            model,
            path: pathName,
            ...outcome,
          });
        }
      }
    }

    meter.restore();
    console.log(formatReport(results));
    console.log(
      `${PREFIX} ${meter.calls} chat call(s) sent (cap ${options.maxCalls})`
    );
    return exitCodeFor(results);
  } finally {
    await mongoose.disconnect();
  }
}

if (require.main === module) {
  main()
    .then((code) => process.exit(code))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { parseArgs };
