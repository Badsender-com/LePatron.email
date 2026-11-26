'use strict';

/**
 * When a version of a skill or an expertise was published, as an assistant
 * reads it (ADR 0031): in UTC, or nothing when its publication was never
 * recorded, or for a draft tried in the drafts mode. Never a guessed date.
 */

const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const { readsEveryAudience } = require('../ai-skill/services/audience.js');
const { datedFor } = require('../ai-skill/services/audience-spans.js');

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

// The fields of an item a company dates its versions by: when it was open
// to it (audience-spans.js).
const DATING_FIELDS = ['audience', 'audienceHistory'];

/**
 * The items served to a company, each version dated as that company sees
 * it: a company other than the platform company saw nothing before the item
 * was opened to it, so the version it was opened at is dated, published and
 * last changed, by the opening; the versions published after it keep their
 * date. A draft tried is never dated.
 *
 * @param {Object} group the company served
 * @returns {function({ doc, version, draft }): Object} the item, its
 *   version's `activatedAt` and `updatedAt` as the company sees them
 */
function seenBy(group) {
  const everyAudience = readsEveryAudience(group);
  return (found) => {
    if (everyAudience || found.draft) return found;
    const { doc, version } = found;
    const dated = (date) => datedFor(doc, date, false);
    return {
      ...found,
      version: {
        ...version,
        activatedAt: dated(version.activatedAt),
        ...(version.updatedAt && { updatedAt: dated(version.updatedAt) }),
      },
    };
  };
}

module.exports = {
  isoOf,
  publishedAtOf,
  versionLine,
  lastModifiedOf,
  seenBy,
  DATING_FIELDS,
};
