'use strict';

/**
 * When a version of a skill or an expertise was published, as an assistant
 * reads it (ADR 0031): in UTC, or nothing when its publication was never
 * recorded, or for a draft tried in the drafts mode. Never a guessed date.
 */

const { versionLabel } = require('../ai-skill/services/version-helpers.js');

const isoOf = (date) => (date ? new Date(date).toISOString() : null);

/**
 * @param {Object} version a version, with its `activatedAt` as stored
 * @param {boolean} [draft] whether it is served as a draft
 * @returns {string|null}
 */
function publishedAtOf(version, draft = false) {
  if (draft || !version) return null;
  return isoOf(version.activatedAt);
}

/**
 * The version line of a resource: its number, and its publication day, which
 * says it is in UTC: a version published late in the evening in Paris is
 * dated the day before.
 */
function versionLine(version, draft = false) {
  const at = publishedAtOf(version, draft);
  const label = `Version ${versionLabel(version)}`;
  return at ? `${label}, published on ${at.slice(0, 10)} (UTC).` : `${label}.`;
}

/** When a version last changed, for a resource's `lastModified`. */
function lastModifiedOf(version) {
  return isoOf(version.updatedAt || version.activatedAt) || undefined;
}

module.exports = { isoOf, publishedAtOf, versionLine, lastModifiedOf };
