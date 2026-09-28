'use strict';

const { UnprocessableEntity } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');

// The quality findings ignored on an email (the quality drawer's "Ignore").
// A finding is known by its fingerprint, computed in the editor
// (ext/quality/engine.js): the server stores it opaquely, it never runs checks.

// An email has a few dozen findings at most; the ceiling only bounds the
// document against a runaway client.
const MAX_QUALITY_IGNORES = 500;
const MAX_FINGERPRINT_LENGTH = 512;
// Rule ids are kebab-case names (ext/quality/rules/*.js).
const RULE_ID = /^[a-z0-9-]{1,64}$/;

module.exports = {
  validateIgnorePayload,
  applyIgnore,
  MAX_QUALITY_IGNORES,
};

/**
 * The one change a request asks for, validated: ignore a finding, or stop
 * ignoring it. Any other key is refused, so a caller is never silently ignored.
 * @param {Object} payload
 * @returns {{ fingerprint: string, ruleId: string|null, ignored: boolean }}
 */
function validateIgnorePayload(payload = {}) {
  const unknown = Object.keys(payload).filter(
    (key) => !['fingerprint', 'ruleId', 'ignored'].includes(key)
  );
  if (unknown.length) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_QUALITY_IGNORE);
  }
  const { fingerprint, ruleId = null, ignored } = payload;
  if (
    typeof fingerprint !== 'string' ||
    !fingerprint.trim() ||
    fingerprint.length > MAX_FINGERPRINT_LENGTH ||
    typeof ignored !== 'boolean' ||
    (ruleId !== null && (typeof ruleId !== 'string' || !RULE_ID.test(ruleId)))
  ) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_QUALITY_IGNORE);
  }
  return { fingerprint, ruleId, ignored };
}

/**
 * Applies the change to the mailing document (not saved). Idempotent: ignoring
 * an ignored finding, or releasing a released one, changes nothing.
 * @param {Object} mailing - the mailing document
 * @param {{ fingerprint, ruleId, ignored }} change - a validated payload
 * @param {Object} user - who ignores it
 * @returns {string[]} the fingerprints ignored afterwards
 */
function applyIgnore(mailing, { fingerprint, ruleId, ignored }, user) {
  const current = mailing.qualityIgnores || [];
  const exists = current.some((ignore) => ignore.fingerprint === fingerprint);

  if (ignored && !exists) {
    if (current.length >= MAX_QUALITY_IGNORES) {
      throw new UnprocessableEntity(ERROR_CODES.QUALITY_IGNORES_LIMIT_REACHED);
    }
    mailing.qualityIgnores = current.concat({
      fingerprint,
      ruleId,
      _user: user && user.id,
      ignoredAt: new Date(),
    });
  } else if (!ignored && exists) {
    mailing.qualityIgnores = current.filter(
      (ignore) => ignore.fingerprint !== fingerprint
    );
  }
  return (mailing.qualityIgnores || []).map((ignore) => ignore.fingerprint);
}
