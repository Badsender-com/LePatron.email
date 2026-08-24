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

module.exports = {
  parseVersionParam,
  versionLabel,
  findVersion,
  findActiveVersion,
  maxMajor,
  maxMinorFor,
  assertDraft,
};
