'use strict';

/**
 * The key a publication guard answers (ADR 0019): what the server signs once
 * the guard has run, for the versions it ran on as they were then (their
 * `updatedAt`), for the person who ran it, with what it showed. A publication
 * of a version a feature uses requires it, and records what the key carries,
 * never what a page declares. Signed (signed-key.js), so nothing is held
 * between the guard and the publication: an assistant's confirmation in two
 * steps is the same key.
 */

const createError = require('http-errors');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  signKey,
  readKey,
  isExpired,
  KEY_LIFETIME_MS,
} = require('../../utils/signed-key.js');

// Keeps this signature from standing for any other the secret makes.
const PURPOSE = 'skills-publication-guard';

const label = ({ major, minor }) => `${major}.${minor}`;
const isoOf = (date) => (date ? new Date(date).toISOString() : null);

const invalid = () =>
  createError(400, ERROR_CODES.SKILL_PUBLICATION_GUARD_INVALID);

// A case fails when its new output is missing or breaks the contract.
const failedCases = (cases) =>
  cases.filter(
    (c) =>
      !c.after || c.after.error || (c.contract && c.contract.after === false)
  ).length;

/**
 * @param {Object} params
 * @param {Array<{ kind, id, version: { major, minor }, updatedAt }>}
 *   params.targets the versions the guard ran on, as they were read
 * @param {{ cases: Object[], missing: string[] }} params.guard what it showed
 * @param {string} [params.terms] a digest of what else the publication must
 *   be asked with, as checked: an assistant's changelog and release notes
 * @param {{ id: string }} user who ran it
 * @returns {string}
 */
function issueGuardKey({ targets, guard, terms }, user) {
  const claims = {
    targets: targets.map(({ kind, id, version, updatedAt }) => ({
      kind,
      id,
      version: label(version),
      updatedAt: isoOf(updatedAt),
    })),
    by: String(user && user.id),
    at: Date.now(),
    guard: {
      cases: guard.cases.length,
      failed: failedCases(guard.cases),
      missing: guard.missing || [],
      notReplayed: guard.notReplayed || 0,
    },
    ...(terms && { terms }),
  };
  return signKey(PURPOSE, claims);
}

/**
 * What the guard showed for one version, if the key says it ran on it, for
 * this person, within the hour.
 *
 * @param {string} key
 * @param {{ kind, id, version: { major, minor } }} target
 * @param {{ id: string }} user
 * @returns {{ updatedAt: string|null,
 *   guard: { cases: number, failed: number, missing: string[] },
 *   terms?: string }}
 *   `updatedAt`: the version's, when the guard ran; `terms`: as issued
 * @throws {HttpError} 400 `SKILL_PUBLICATION_GUARD_INVALID`
 */
function readGuardKey(key, { kind, id, version }, user) {
  const claims = typeof key === 'string' ? readKey(PURPOSE, key) : null;
  if (
    !claims ||
    !Array.isArray(claims.targets) ||
    claims.by !== String(user && user.id) ||
    isExpired(claims)
  ) {
    throw invalid();
  }
  const ran = claims.targets.find(
    (t) => t.kind === kind && t.id === id && t.version === label(version)
  );
  if (!ran) throw invalid();
  return { updatedAt: ran.updatedAt, guard: claims.guard, terms: claims.terms };
}

// The key a request carries, a string or nothing: never what the guard
// showed, which the server records from its key.
function guardKeyIn(body) {
  const { guardKey } = body || {};
  return typeof guardKey === 'string' ? guardKey : undefined;
}

module.exports = {
  guardKeyIn,
  issueGuardKey,
  readGuardKey,
  isoOf,
  KEY_LIFETIME_MS,
};
