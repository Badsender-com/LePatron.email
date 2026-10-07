'use strict';

const { UnprocessableEntity } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { CHECKS, CHECK_STATES } = require('../../shared/quality/checks.js');

/**
 * Validates a `qualitySettings` payload of a group or a template, and merges it
 * into what is stored (docs/adr/0004-quality-settings-per-group-and-template.md).
 *
 * Shape: `{ checks: { [checkId]: { state? } } }`. Only what is set is stored:
 * a value left out is inherited (the catalogue's default for a group, the
 * group's for a template). `null` removes a value, so it is inherited again.
 *
 * Partial-safe like sanitizeEmailMetadata: a payload only changes the checks
 * and values it names; the rest of the stored settings stays.
 *
 * Throws an UnprocessableEntity carrying ERROR_CODES.INVALID_QUALITY_SETTINGS,
 * the reason in `.details`: an unknown check, an unknown state, a shape that is
 * not an object. A setting nothing would apply is refused rather than stored.
 *
 * @param {Object} raw the payload's qualitySettings
 * @param {Object} [stored] the settings stored on the group or template
 * @returns {{ checks: Object }}
 */
function sanitizeQualitySettings(raw, stored) {
  const fail = (details) => {
    const err = new UnprocessableEntity(ERROR_CODES.INVALID_QUALITY_SETTINGS);
    err.details = details;
    return err;
  };
  const isObject = (value) =>
    value !== null && typeof value === 'object' && !Array.isArray(value);
  // Own keys only: "constructor" or "toString" are not checks of the catalogue.
  const isCheck = (id) => Object.prototype.hasOwnProperty.call(CHECKS, id);

  const current = stored && isObject(stored.checks) ? { ...stored.checks } : {};
  if (raw === null || raw === undefined) return { checks: current };
  if (!isObject(raw)) throw fail('qualitySettings must be an object');
  const unknownKeys = Object.keys(raw).filter((key) => key !== 'checks');
  if (unknownKeys.length) throw fail(`Unknown keys: ${unknownKeys.join(', ')}`);
  if (raw.checks === undefined) return { checks: current };
  if (!isObject(raw.checks)) throw fail('checks must be an object');

  Object.entries(raw.checks).forEach(([checkId, change]) => {
    if (!isCheck(checkId)) throw fail(`Unknown check: ${checkId}`);
    if (!isObject(change)) throw fail(`${checkId} must be an object`);
    const unknown = Object.keys(change).filter((key) => key !== 'state');
    if (unknown.length) {
      throw fail(`Unknown settings of ${checkId}: ${unknown.join(', ')}`);
    }
    const stored = Object.prototype.hasOwnProperty.call(current, checkId)
      ? current[checkId]
      : {};
    const next = { ...stored };
    if ('state' in change) {
      if (change.state === null) delete next.state;
      else if (!CHECK_STATES.includes(change.state)) {
        throw fail(`Unknown state of ${checkId}: ${change.state}`);
      } else next.state = change.state;
    }
    if (Object.keys(next).length) current[checkId] = next;
    else delete current[checkId];
  });

  return { checks: current };
}

module.exports = { sanitizeQualitySettings };
