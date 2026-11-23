'use strict';

const { UnprocessableEntity } = require('http-errors');
const ERROR_CODES = require('../constant/error-codes.js');
const { Mailings } = require('../common/models.common.js');

// The quality findings ignored on an email (the quality drawer's "Ignore").
// A finding is known by its fingerprint, computed in the editor
// (ext/quality/engine.js): the server stores it opaquely, it never runs checks.

// An email has a few dozen findings at most; the ceiling only bounds the
// document against a runaway client. Fingerprints of findings that no longer
// exist (the content changed) are never reported again: at the ceiling, the
// oldest gives way, so "Ignore" keeps working on a long-lived email.
const MAX_QUALITY_IGNORES = 500;
const MAX_FINGERPRINT_LENGTH = 512;
// Rule ids are kebab-case names (ext/quality/rules/*.js), and open the
// fingerprint: `rule|block|property|hash|rank`.
const RULE_ID = /^[a-z0-9-]{1,64}$/;

// What deciding who may ignore a finding reads: the tenant and the location
// (mailing.service assertUserCanEditMailing). Never `data` nor `previewHtml`,
// which weigh megabytes and are not needed to store a fingerprint.
const IGNORE_PROJECTION = { _company: 1, _workspace: 1, _parentFolder: 1 };

module.exports = {
  validateIgnorePayload,
  ruleIdOf,
  setIgnored,
  MAX_QUALITY_IGNORES,
  IGNORE_PROJECTION,
};

/**
 * The one change a request asks for, validated: ignore a finding, or stop
 * ignoring it. Any other key is refused, so a caller is never silently ignored.
 * @param {Object} payload
 * @returns {{ fingerprint: string, ignored: boolean }}
 */
function validateIgnorePayload(payload = {}) {
  const unknown = Object.keys(payload).filter(
    (key) => !['fingerprint', 'ignored'].includes(key)
  );
  if (unknown.length) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_QUALITY_IGNORE);
  }
  const { fingerprint, ignored } = payload;
  if (
    typeof fingerprint !== 'string' ||
    !fingerprint.trim() ||
    fingerprint.length > MAX_FINGERPRINT_LENGTH ||
    typeof ignored !== 'boolean'
  ) {
    throw new UnprocessableEntity(ERROR_CODES.INVALID_QUALITY_IGNORE);
  }
  return { fingerprint, ignored };
}

/**
 * The check that raised a finding, read from its fingerprint: kept for audit,
 * and derived rather than trusted from the request.
 * @param {string} fingerprint
 * @returns {string|null}
 */
function ruleIdOf(fingerprint) {
  const [ruleId] = String(fingerprint).split('|');
  return RULE_ID.test(ruleId) ? ruleId : null;
}

/**
 * Stores the change on the email, in one atomic update: reading the document,
 * changing the array and saving it back made two overlapping "Ignore" of the
 * same user fail on the version check (image.service.js says the same about
 * galleries). Idempotent: ignoring an ignored finding, or releasing a released
 * one, changes nothing.
 * @param {ObjectId|string} mailingId - a mailing the user may edit
 * @param {{ fingerprint: string, ignored: boolean }} change - a validated payload
 * @param {Object} user - who ignores it
 * @returns {Promise<string[]>} the fingerprints ignored afterwards
 */
async function setIgnored(mailingId, { fingerprint, ignored }, user) {
  if (ignored) {
    await Mailings.updateOne(
      { _id: mailingId, 'qualityIgnores.fingerprint': { $ne: fingerprint } },
      {
        $push: {
          qualityIgnores: {
            $each: [
              {
                fingerprint,
                ruleId: ruleIdOf(fingerprint),
                _user: user && user.id,
                ignoredAt: new Date(),
              },
            ],
            // Stored in the order they were ignored: the oldest gives way.
            $slice: -MAX_QUALITY_IGNORES,
          },
        },
      }
    );
  } else {
    await Mailings.updateOne(
      { _id: mailingId },
      { $pull: { qualityIgnores: { fingerprint } } }
    );
  }
  const mailing = await Mailings.findOne(
    { _id: mailingId },
    { 'qualityIgnores.fingerprint': 1 }
  );
  return ((mailing && mailing.qualityIgnores) || []).map(
    (ignore) => ignore.fingerprint
  );
}
