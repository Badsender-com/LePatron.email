'use strict';

const { UnprocessableEntity } = require('http-errors');

const ERROR_CODES = require('../constant/error-codes.js');
const { CHECKS, CHECK_STATES } = require('../../shared/quality/checks.js');

/**
 * Validates a `qualitySettings` payload of a group or a template, and merges it
 * into what is stored (docs/adr/0004-quality-settings-per-group-and-template.md).
 *
 * Shape: `{ checks: { [checkId]: { state?, thresholds?: { [name]: number } } } }`.
 * Only what is set is stored:
 * a value left out is inherited (the catalogue's default for a group, the
 * group's for a template). `null` removes a value, so it is inherited again.
 *
 * Partial-safe like sanitizeEmailMetadata: a payload only changes the checks
 * and values it names; the rest of the stored settings stays.
 *
 * Throws an UnprocessableEntity carrying ERROR_CODES.INVALID_QUALITY_SETTINGS,
 * the reason in `.details`: an unknown check, state or threshold, a threshold
 * that is not a number or lies outside its bounds, a shape that is not an
 * object. A setting nothing would apply is refused rather than stored.
 *
 * @param {Object} raw the payload's qualitySettings
 * @param {Object} [stored] the settings stored on the group or template
 * @returns {{ checks: Object }}
 */
function sanitizeQualitySettings(raw, stored, inherited = {}) {
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
    const unknown = Object.keys(change).filter(
      (key) => key !== 'state' && key !== 'thresholds'
    );
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
    if ('thresholds' in change && change.thresholds !== null) {
      next.thresholds = mergeThresholds(
        checkId,
        change.thresholds,
        next.thresholds,
        fail,
        inherited[checkId]
      );
      if (!Object.keys(next.thresholds).length) delete next.thresholds;
    } else if ('thresholds' in change) {
      delete next.thresholds;
    }
    if (Object.keys(next).length) current[checkId] = next;
    else delete current[checkId];
  });

  return { checks: current };
}

// The thresholds of one check, merged into the stored ones: within the
// catalogue's bounds, `null` bringing one back to its default. `inherited`
// holds what a template's unset thresholds follow (its group's values).
function mergeThresholds(checkId, raw, stored, fail, inherited = {}) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw fail(`thresholds of ${checkId} must be an object`);
  }
  const known = CHECKS[checkId].thresholds;
  const merged = { ...(stored || {}) };
  Object.entries(raw).forEach(([name, value]) => {
    // Own keys only: "constructor" is not a threshold of the catalogue.
    if (!Object.prototype.hasOwnProperty.call(known, name)) {
      throw fail(`Unknown threshold of ${checkId}: ${name}`);
    }
    const threshold = known[name];
    if (value === null) {
      delete merged[name];
      return;
    }
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      throw fail(`${checkId}.${name} must be a number`);
    }
    if (value < threshold.min || value > threshold.max) {
      throw fail(
        `${checkId}.${name} must lie between ${threshold.min} and ${threshold.max}`
      );
    }
    merged[name] = value;
  });
  // Thresholds that go together stay in order once merged, with what is
  // inherited or the defaults: an error level under its warning level would
  // never be reached.
  CHECKS[checkId].ordered.forEach(([low, high]) => {
    const value = (name) => {
      if (name in merged) return merged[name];
      if (Number.isFinite(inherited[name])) return inherited[name];
      return known[name].default;
    };
    if (value(low) > value(high)) {
      throw fail(`${checkId}.${low} must not exceed ${checkId}.${high}`);
    }
  });
  return merged;
}

module.exports = { sanitizeQualitySettings };
