'use strict';

const path = require('path');

const ProviderFactory = require(path.resolve(
  __dirname,
  '..',
  '..',
  'packages',
  'server',
  'integration-providers',
  'provider-factory.js'
));
const quirksCache = require(path.resolve(
  __dirname,
  '..',
  '..',
  'packages',
  'server',
  'integration-providers',
  'ai',
  'param-quirks.cache.js'
));
const { quirkKey } = require(path.resolve(
  __dirname,
  '..',
  '..',
  'packages',
  'server',
  'integration-providers',
  'ai',
  'param-quirks.js'
));
const { VERDICTS } = require('./report.js');

/**
 * Running one model through one code path, for real.
 *
 * Both probes call the production methods — `chatComplete` and
 * `translateBatch` — never a request rebuilt here. A rebuilt request would
 * prove that this script works, not that the product does.
 *
 * The two paths do not send the same thing, which is why both exist: the skill
 * path carries an output schema (and so exercises Anthropic's forced tool) and
 * usually no temperature, while translation always sends a temperature and a
 * reasoning effort and never a token cap. A model can pass one and fail the
 * other — that is exactly how gpt-6-astra reached staging.
 */

// Low enough to stay cheap, high enough that a reasoning model still answers.
// A cap of a few tokens makes them return empty and look broken.
const DEFAULT_MAX_TOKENS = 1024;

const TRANSIENT_CODES = new Set([
  'PROVIDER_TIMEOUT',
  'PROVIDER_QUOTA_EXCEEDED',
]);

function isTransient(error) {
  if (!error) return false;
  if (TRANSIENT_CODES.has(error.code)) return true;
  // 5xx and network failures: the provider, not the request.
  return /\b(50\d|429)\b/.test(error.message || '');
}

async function probeSkillPath(provider, model) {
  const responseFormat =
    typeof provider.supportsJsonResponseFormat === 'function' &&
    provider.supportsJsonResponseFormat()
      ? {
          type: 'json_object',
          // The schema is what triggers Anthropic's forced tool call. Without
          // it this probe would skip that path entirely.
          schema: {
            type: 'object',
            properties: { ok: { type: 'boolean' } },
            required: ['ok'],
          },
        }
      : undefined;

  // No temperature: the skill path leaves it out unless a group or a skill
  // sets one.
  const result = await provider.chatComplete({
    model,
    messages: [
      { role: 'system', content: 'You answer with JSON only.' },
      { role: 'user', content: 'Return {"ok":true} and nothing else.' },
    ],
    maxTokens: DEFAULT_MAX_TOKENS,
    responseFormat,
  });

  if (!result.content || !result.content.trim()) {
    throw new Error('empty response');
  }
  return result;
}

async function probeTranslationPath(provider, model, integration) {
  // translateBatch resolves its own model from config, so the provider has to
  // be built with the model under test rather than told about it per call.
  const scoped = ProviderFactory.createProvider(integration, { model });
  // Shaped like a real email block, not a minimal pair. An earlier version
  // sent two two-word strings under `data.a` / `data.b` and claude-fable-5
  // declined it outright — reproducibly, while the same model translates real
  // content without trouble. A probe that does not look like production
  // measures the probe, not the product.
  const texts = {
    'data.header.titleText': 'Découvrez notre collection de printemps',
    'data.body.text':
      'Des pièces légères et des couleurs franches, disponibles dès maintenant sur la boutique.',
    'data.cta.label': 'Voir la collection',
  };

  const translated = await scoped.translateBatch({
    texts,
    sourceLanguage: 'fr',
    targetLanguage: 'en',
  });

  // A model can return valid JSON in the wrong shape — nested instead of the
  // flat dotted keys the extractor produced. That is a failure of this path,
  // not a success.
  for (const key of Object.keys(texts)) {
    if (typeof translated[key] !== 'string' || !translated[key].trim()) {
      throw new Error(`missing or non-string key ${key}`);
    }
  }
  return translated;
}

const PROBES = {
  skill: probeSkillPath,
  translation: probeTranslationPath,
};

/**
 * Probe one model on one path, retrying only what is worth retrying.
 *
 * A refusal is reproducible by definition, so replaying it buys nothing. Only
 * the transient classes are retried — and a run that both succeeded and failed
 * is reported as such rather than averaged into a verdict it does not have.
 *
 * @returns {{verdict: string, detail: string}}
 */
async function runProbe({
  provider,
  integration,
  model,
  pathName,
  samples = 1,
  retries = 2,
}) {
  const key = quirkKey({
    providerType: provider.getProviderType(),
    baseUrl: provider.baseUrl,
    model,
  });
  quirksCache.clear();

  let succeeded = 0;
  let lastError = null;

  for (let sample = 0; sample < samples; sample += 1) {
    let attempt = 0;
    for (;;) {
      try {
        await PROBES[pathName](provider, model, integration);
        succeeded += 1;
        break;
      } catch (error) {
        lastError = error;
        if (attempt < retries && isTransient(error)) {
          attempt += 1;
          await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
          continue;
        }
        break;
      }
    }
  }

  const learned = quirksCache.list(key);

  if (succeeded === samples) {
    return learned.length
      ? {
          verdict: VERDICTS.ADAPTED,
          detail: learned
            .map((q) =>
              q.action === 'rename'
                ? `rename ${q.param}→${q.to}`
                : `drop ${q.param}`
            )
            .join('; '),
        }
      : { verdict: VERDICTS.OK, detail: '' };
  }

  if (succeeded > 0) {
    return {
      verdict: VERDICTS.FLAKY,
      detail: `${succeeded}/${samples} OK — ${shortMessage(lastError)}`,
    };
  }

  // A model the key is not entitled to is not an incompatibility: the listing
  // offers it, the subscription does not cover it. Reporting that as a failure
  // would bury the real ones.
  if (isUnentitled(lastError)) {
    return { verdict: VERDICTS.SKIPPED, detail: shortMessage(lastError) };
  }

  return {
    verdict: isTransient(lastError) ? VERDICTS.TRANSIENT : VERDICTS.FAIL,
    detail: shortMessage(lastError),
  };
}

function isUnentitled(error) {
  if (!error) return false;
  if (error.code === 'PROVIDER_INVALID_CREDENTIALS') return true;
  return /\b40[13]\b/.test(error.message || '');
}

function shortMessage(error) {
  return String((error && error.message) || 'unknown').slice(0, 90);
}

module.exports = {
  runProbe,
  PROBES,
  DEFAULT_MAX_TOKENS,
  isTransient,
  isUnentitled,
};
