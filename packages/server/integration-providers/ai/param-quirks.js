'use strict';

/**
 * Which request parameter a provider just refused, and what to do about it.
 *
 * The model list is fetched live from the provider, so it offers models the
 * code has never heard of — and each generation changes which parameters it
 * accepts. `gpt-6-astra` reached staging and failed because a hand-written
 * pattern did not recognise it as needing `max_completion_tokens`. Reading the
 * refusal is the only approach that survives the next generation.
 *
 * Deliberately closed: only the parameters below are ever adapted. A refusal
 * naming anything else is left alone, which is what keeps a genuine
 * misconfiguration (a bad model id, a malformed message list) from being
 * quietly retried into something else.
 */

// Statuses that mean "the request was refused before anything was generated".
// 422 is Infomaniak's spelling of the same thing.
const REFUSAL_STATUSES = new Set([400, 422]);

const UNSUPPORTED_CODES = new Set([
  'unsupported_parameter',
  'unsupported_value',
]);

// A value the model will not take, but which it tells us how to fix — as
// opposed to a parameter it refuses outright.
const INVALID_VALUE_CODE = 'invalid_value';

// "max_tokens is too large: 16000. This model supports at most 4096 …"
const TOO_LARGE = /is too large[^.]*\.\s*This model supports at most (\d+)/i;

/**
 * The only parameters we accept to adapt, and how.
 *
 * `rename` is symmetric on the token limit: newer OpenAI models want
 * `max_completion_tokens`, while older OpenAI-compatible gateways only know
 * `max_tokens`, and an integration can point at either.
 */
const ADAPTABLE_PARAMS = Object.freeze({
  max_tokens: { action: 'rename', to: 'max_completion_tokens' },
  max_completion_tokens: { action: 'rename', to: 'max_tokens' },
  temperature: { action: 'drop' },
  reasoning_effort: { action: 'drop' },
  response_format: { action: 'drop' },
});

// Used only when the payload carries no `param`. Anchored on OpenAI's exact
// wording so other dialects fall through rather than matching by accident.
const PARAM_FROM_MESSAGE = [
  /Unsupported parameter: '([^']+)' is not supported/i,
  /Unsupported value: '([^']+)'/i,
];

function paramFromMessage(message) {
  for (const pattern of PARAM_FROM_MESSAGE) {
    const match = pattern.exec(message || '');
    if (match) return match[1];
  }
  return null;
}

/**
 * @param {number} status
 * @param {Object|null} parsedError  provider error body, already parsed
 * @param {string} [message]         sanitised message, used as a fallback
 * @returns {{param, action: 'drop'|'rename'|'clamp', to?, value?}|null}
 */
function detectParamQuirk(status, parsedError, message) {
  if (!REFUSAL_STATUSES.has(status)) return null;

  const error = (parsedError && parsedError.error) || {};

  // A ceiling the model states outright. Older models cap completions well
  // below our default, and the translation path sends that default because it
  // passes no maxTokens of its own — so gpt-4-turbo could not translate at
  // all. Clamping is safe because the provider named the limit.
  if (error.code === INVALID_VALUE_CODE) {
    const limit = TOO_LARGE.exec(error.message || message || '');
    if (limit && error.param && error.param.startsWith('max_')) {
      return { param: error.param, action: 'clamp', value: Number(limit[1]) };
    }
    return null;
  }

  // A code we do not know means we do not know what a retry would change.
  if (error.code && !UNSUPPORTED_CODES.has(error.code)) return null;

  const fromMessage = paramFromMessage(message || error.message);

  // No code at all: `param` alone proves nothing. OpenAI-compatible gateways
  // (vLLM, LiteLLM) answer `code: null` with a `param` on an ordinary value
  // error, and dropping that parameter would hide a real misconfiguration —
  // then remember it for every group on that host. OpenAI's own wording is
  // the only evidence accepted, and it must name the same parameter.
  if (!error.code) {
    if (!fromMessage) return null;
    if (error.param && error.param !== fromMessage) return null;
  }

  const param = error.param || fromMessage;
  if (!param) return null;

  const rule = ADAPTABLE_PARAMS[param];
  if (!rule) return null;

  return { param, ...rule };
}

/**
 * Apply quirks to a request body. Never mutates its input: the caller keeps
 * the original around to report what was actually sent.
 *
 * @param {Object} body
 * @param {Array<{param: string, action: string, to?: string}>} quirks
 * @returns {Object}
 */
function applyQuirks(body, quirks) {
  const next = { ...body };

  for (const quirk of quirks || []) {
    if (!(quirk.param in next)) continue;

    if (quirk.action === 'clamp') {
      // Only ever downwards: a stale ceiling must not raise a request.
      next[quirk.param] = Math.min(next[quirk.param], quirk.value);
      continue;
    }

    const value = next[quirk.param];
    delete next[quirk.param];
    if (quirk.action === 'rename' && quirk.to) next[quirk.to] = value;
  }

  return next;
}

/**
 * Name the adaptation exactly. Anything that was not a rename used to be
 * printed as "drop", so a ceiling clamped to 4096 — the one production bug the
 * sweep found — was reported with the wrong cause.
 */
function describeQuirk(quirk) {
  if (quirk.action === 'rename') return `rename ${quirk.param}→${quirk.to}`;
  if (quirk.action === 'clamp') return `clamp ${quirk.param}→${quirk.value}`;
  return `drop ${quirk.param}`;
}

/**
 * Cache key for a learned quirk.
 *
 * Keyed on the model at this endpoint, not on the integration: the quirk is a
 * property of the model, so two groups calling the same endpoint share what
 * either one discovers. The endpoint, not just the host: an OpenAI-compatible
 * host can serve the same model id under a different contract, and on Azure
 * the deployment and the api-version live in the URL — two integrations on
 * one resource can run different models under the same `model` value.
 */
function quirkKey({ providerType, endpoint, model }) {
  return `${providerType}|${endpoint}|${model}`;
}

module.exports = {
  detectParamQuirk,
  applyQuirks,
  describeQuirk,
  quirkKey,
  ADAPTABLE_PARAMS,
  REFUSAL_STATUSES,
};
