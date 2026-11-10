'use strict';

/**
 * Shared helpers for the major/minor version scheme used by LePatronSkill
 * and Expertise documents.
 */

const createError = require('http-errors');

/**
 * Parse a route param like "1.2" → { major: 1, minor: 2 }.
 * Missing minor defaults to 0. Returns null on invalid input.
 */
function parseVersionParam(value) {
  if (value === null || value === undefined) return null;
  const [majorStr, minorStr] = String(value).split('.');
  const major = Number(majorStr);
  const minor = minorStr === undefined ? 0 : Number(minorStr);
  if (!Number.isFinite(major) || !Number.isFinite(minor)) return null;
  return { major, minor };
}

function versionLabel(v) {
  return `${v.versionMajor}.${v.versionMinor}`;
}

function findVersion(doc, major, minor) {
  return (doc.versions || []).find(
    (v) => v.versionMajor === Number(major) && v.versionMinor === Number(minor)
  );
}

function findActiveVersion(doc) {
  const av = doc.activeVersion || {};
  if (av.major == null) return null;
  return findVersion(doc, av.major, av.minor || 0);
}

function maxMajor(doc) {
  return (doc.versions || []).reduce(
    (max, v) => (v.versionMajor > max ? v.versionMajor : max),
    0
  );
}

function maxMinorFor(doc, major) {
  return (doc.versions || [])
    .filter((v) => v.versionMajor === major)
    .reduce((max, v) => (v.versionMinor > max ? v.versionMinor : max), 0);
}

/**
 * Throw 409 if the version is not editable. DRAFT is the only mutable status;
 * ACTIVE and ARCHIVED are read-only by design (see v1.1 doctrine).
 */
function assertDraft(version) {
  if (!version) throw createError(404, 'Version not found');
  if (version.status !== 'DRAFT') {
    throw createError(
      409,
      `Only DRAFT versions are editable (current status: ${version.status})`
    );
  }
}

/**
 * -1, 0 or 1 as version `a` stands to version `b`, both numbered as stored
 * (`versionMajor`, `versionMinor`).
 *
 * @returns {-1|0|1}
 */
function compareVersions(a, b) {
  if (a.versionMajor !== b.versionMajor) {
    return a.versionMajor > b.versionMajor ? 1 : -1;
  }
  if (a.versionMinor === b.versionMinor) return 0;
  return a.versionMinor > b.versionMinor ? 1 : -1;
}

const isAfter = (a, b) => compareVersions(a, b) > 0;

/**
 * The draft being written: the latest DRAFT version, provided it is newer
 * than the active one. A draft left behind by a later publication is not
 * open any more: publishing archives only the previous active version.
 *
 * @param {Object} doc a skill or an expertise
 * @returns {Object|null} the version
 */
function openDraftOf(doc) {
  const active = findActiveVersion(doc);
  return (doc.versions || [])
    .filter((v) => v.status === 'DRAFT' && (!active || isAfter(v, active)))
    .reduce((latest, v) => (!latest || isAfter(v, latest) ? v : latest), null);
}

/**
 * A version's new update date: now, and always later than the one it had, so
 * that a write conditioned on the date read (versioned-draft.js) never
 * mistakes a version written since for the one read, even within the same
 * millisecond.
 *
 * @param {Date} [previous]
 * @param {Date|number} [now] the time it is, for a caller that reads it once
 * @returns {Date}
 */
function laterThan(previous, now = Date.now()) {
  const before = previous ? new Date(previous).getTime() : 0;
  return new Date(Math.max(new Date(now).getTime(), before + 1));
}

module.exports = {
  compareVersions,
  laterThan,
  parseVersionParam,
  versionLabel,
  findVersion,
  findActiveVersion,
  maxMajor,
  maxMinorFor,
  assertDraft,
  openDraftOf,
};
