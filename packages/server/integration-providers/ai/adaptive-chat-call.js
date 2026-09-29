'use strict';

const logger = require('../../utils/logger.js');
const { applyQuirks } = require('./param-quirks.js');
const quirksCache = require('./param-quirks.cache.js');

/**
 * Run a chat call, adapting the request to what the model actually accepts.
 *
 * A refusal names the offending parameter, so the request can be corrected and
 * replayed instead of failing. What is learned is remembered, so the cost is
 * one refused request per model rather than one per call.
 *
 * Two replays, not one: on the translation path a single model can be refused
 * twice in a row — first on the token limit, then on the temperature that path
 * always sends. Stopping after one would leave translation broken.
 *
 * Termination is structural rather than a counter: a parameter already adapted
 * in this sequence cannot be adapted again, so every round removes a distinct
 * one from a closed list of five.
 */

const MAX_ATTEMPTS = 3;
// Never let the budget reach zero: a 1ms timeout fails in a way that looks
// like the provider rather than like us.
const MIN_ATTEMPT_TIMEOUT_MS = 1000;

/**
 * @param {Object} params
 * @param {Function} params.performAttempt async (body, timeoutMs) =>
 *   {ok: true, data} | {ok: false, status, parsedError, message}
 * @param {Object} params.body
 * @param {Function} params.detect (status, parsedError, message) => quirk|null
 * @param {string} params.key cache key for this model
 * @param {number} params.deadlineAt absolute deadline for the whole sequence
 * @param {string} params.label provider/model, for the log line
 * @returns {Promise<{data: Object, body: Object}>}
 * @throws the last refusal, untouched, when nothing more can be adapted
 */
async function callWithParamAdaptation({
  performAttempt,
  body,
  detect,
  key,
  deadlineAt,
  label,
}) {
  // Start from what is already known about this model, so the refusal is not
  // paid again on every process that has seen it.
  const known = quirksCache.list(key);
  let currentBody = known.length ? applyQuirks(body, known) : body;

  const adapted = new Set(known.map((quirk) => quirk.param));
  let lastFailure = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const remaining = deadlineAt - Date.now();
    const result = await performAttempt(
      currentBody,
      Math.max(MIN_ATTEMPT_TIMEOUT_MS, remaining)
    );

    if (result.ok) return { data: result.data, body: currentBody };

    lastFailure = result;

    const quirk = detect(result.status, result.parsedError, result.message);
    // Already tried this one: the provider is refusing something we cannot
    // fix, and replaying would loop.
    if (!quirk || adapted.has(quirk.param)) break;

    adapted.add(quirk.param);
    quirksCache.add(key, quirk);
    currentBody = applyQuirks(currentBody, [quirk]);

    // Warn, not log: an adaptation that fires on every call means the
    // fast-path patterns are behind, and that has to be visible.
    logger.error(
      `${label}: adapting request — ${
        quirk.action === 'rename'
          ? `rename ${quirk.param} → ${quirk.to}`
          : `drop ${quirk.param}`
      } (memorised)`
    );
  }

  return { failure: lastFailure, body: currentBody };
}

module.exports = { callWithParamAdaptation, MAX_ATTEMPTS };
