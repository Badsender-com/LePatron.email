'use strict';

const { CHECKS } = require('../../../../../shared/quality/checks');

// The quality settings of the mailing, resolved by the server from its template
// and its group (metadata.qualitySettings, ADR 0004). A mailing loaded without
// them gets every check's default: the quality control as it always was.

const settingsOf = (ctx, checkId) => {
  const checks = ctx.config && ctx.config.quality && ctx.config.quality.checks;
  return (checks && checks[checkId]) || {};
};

/**
 * The state of a check for this mailing: 'off', 'on' or 'blocking'.
 * @returns {string}
 */
function checkStateOf(ctx, checkId) {
  const { state } = settingsOf(ctx, checkId);
  if (state) return state;
  return CHECKS[checkId] ? CHECKS[checkId].defaultState : 'on';
}

/**
 * A threshold of a check for this mailing, its catalogue default when the
 * settings do not set it.
 * @returns {number}
 */
function thresholdOf(ctx, checkId, name) {
  const { thresholds } = settingsOf(ctx, checkId);
  const value = thresholds && thresholds[name];
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return CHECKS[checkId].thresholds[name].default;
}

module.exports = { checkStateOf, thresholdOf };
