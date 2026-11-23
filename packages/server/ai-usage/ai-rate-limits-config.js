'use strict';

// The ceilings an environment may override (lepatron_aiRateLimits__<name>).
const AI_RATE_LIMIT_NAMES = [
  'perUserPerMinute',
  'perUserPerDay',
  'perGroupPerDay',
];

/**
 * Reads the AI rate limits from the config. An environment variable reaches
 * the config as a string (`rc`), so each limit is converted here; a limit
 * that is set but is not a positive number stops the server from starting,
 * rather than leaving its window without any ceiling.
 *
 * @param {Object} [raw] config.aiRateLimits as `rc` merged it
 * @returns {Object} the limits, as numbers; an unset one stays unset
 * @throws {Error} naming the setting that is not a positive number
 */
function parseAiRateLimits(raw = {}) {
  const limits = {};
  AI_RATE_LIMIT_NAMES.forEach((name) => {
    const value = raw[name];
    if (value === undefined || value === null) return;
    // An empty or blank string converts to 0, refused below.
    const limit = typeof value === 'string' ? Number(value) : value;
    if (typeof limit !== 'number' || !Number.isFinite(limit) || limit <= 0) {
      throw new Error(
        `aiRateLimits.${name} (lepatron_aiRateLimits__${name}) must be a positive number, got ${JSON.stringify(
          value
        )}`
      );
    }
    limits[name] = limit;
  });
  return limits;
}

module.exports = { parseAiRateLimits, AI_RATE_LIMIT_NAMES };
