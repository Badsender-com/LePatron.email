'use strict';

const logger = require('../utils/logger.js');

// Thrown to stop a cancelled job, and recognised by message along the way.
const TRANSLATION_CANCELLED = 'TRANSLATION_CANCELLED';

/**
 * Run one step of a mailing translation, log how long it took, then hand the
 * event loop back before the next step.
 *
 * Translating a large mailing held a single-worker server for 5 to 6 seconds
 * before the first provider call, and once for over 5 minutes, with nothing
 * in the logs to say which step. The duration names it; the yield lets the
 * status polls, a cancel and other users' requests through between steps
 * instead of after all of them.
 *
 * @template T
 * @param {string} label - Step name, as it appears in the log
 * @param {() => T | Promise<T>} step
 * @returns {Promise<T>}
 */
async function runTranslationStep(label, step) {
  const startedAt = Date.now();
  const result = await step();
  logger.log(`[Translation] ${label} took ${Date.now() - startedAt}ms`);
  await yieldToEventLoop();
  return result;
}

function yieldToEventLoop() {
  return new Promise((resolve) => setImmediate(resolve));
}

module.exports = { runTranslationStep, TRANSLATION_CANCELLED };
