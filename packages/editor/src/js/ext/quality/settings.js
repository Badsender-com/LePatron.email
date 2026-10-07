'use strict';

const { CHECKS } = require('../../../../../shared/quality/checks');

// The quality settings of the mailing, resolved by the server from its template
// and its group (metadata.qualitySettings, ADR 0004). A mailing loaded without
// them gets every check's default: the quality control as it always was.

const own = (object, key) =>
  Boolean(object) && Object.prototype.hasOwnProperty.call(object, key);

const settingsOf = (ctx, checkId) => {
  const checks = ctx.config && ctx.config.quality && ctx.config.quality.checks;
  return (own(checks, checkId) && checks[checkId]) || {};
};

/**
 * The state of a check for this mailing: 'off', 'on' or 'blocking'.
 * @returns {string}
 */
function checkStateOf(ctx, checkId) {
  const { state } = settingsOf(ctx, checkId);
  if (state) return state;
  return own(CHECKS, checkId) ? CHECKS[checkId].defaultState : 'on';
}

/**
 * A threshold of a check for this mailing, its catalogue default when the
 * settings do not set it.
 * @returns {number}
 */
function thresholdOf(ctx, checkId, name) {
  const { thresholds } = settingsOf(ctx, checkId);
  const value = own(thresholds, name) && thresholds[name];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return CHECKS[checkId].thresholds[name].default;
}

/**
 * Two thresholds of a check that go together (an info then a warning, a
 * warning then an error), lowest first. A template overriding one of them
 * could put it on the other side of its group's: the check still reads them
 * in order.
 * @returns {[number, number]}
 */
function orderedThresholds(ctx, checkId, lowName, highName) {
  const low = thresholdOf(ctx, checkId, lowName);
  const high = thresholdOf(ctx, checkId, highName);
  return [Math.min(low, high), Math.max(low, high)];
}

module.exports = { checkStateOf, thresholdOf, orderedThresholds };
