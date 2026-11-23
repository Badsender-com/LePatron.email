'use strict';

/**
 * The catalog changes of an item, as a company sees them (ADR 0031): each
 * version published, created or updated, dated by its publication. A company
 * other than the platform company sees an item only while it was open to
 * every company, so a version published while the item was kept to the
 * platform company is never one of its changes.
 *
 * Pure: it reads the item as stored, its versions, its audience and its
 * audience history, and answers plain changes, with what each reader may
 * read of them (`mcp-list-changes.js`).
 */

const { versionLabel } = require('../ai-skill/services/version-helpers.js');
const {
  releaseNoteOf,
  changeLogOf,
} = require('../ai-skill/services/release-texts.js');
const { Audiences } = require('../ai-skill/constant/skill-constants.js');
const { isoOf } = require('./mcp-catalog-dates.js');

const time = (date) => new Date(date).getTime();

/** The versions of an item ever published, the first first. */
function publications(item) {
  return (item.versions || [])
    .filter((version) => version.activatedAt)
    .sort((a, b) => time(a.activatedAt) - time(b.activatedAt));
}

/**
 * When an item was open to every company: spans from an opening to a
 * withdrawal, `-Infinity` when it was open before anything recorded, and
 * `Infinity` while it still is. Before its first recorded change, an item
 * stood at the other audience; with none recorded, at its own all along.
 * Its archiving ends what is open.
 */
function openSpans(item) {
  const history = [...(item.audienceHistory || [])].sort(
    (a, b) => time(a.at) - time(b.at)
  );
  let open = history.length
    ? history[0].audience !== Audiences.ALL
    : item.audience === Audiences.ALL;
  let from = -Infinity;
  const spans = [];
  history.forEach((change) => {
    const opens = change.audience === Audiences.ALL;
    if (opens && !open) from = time(change.at);
    if (!opens && open) spans.push({ from, to: time(change.at) });
    open = opens;
  });
  if (open) spans.push({ from, to: Infinity });
  const end = item.archivedAt ? time(item.archivedAt) : Infinity;
  return spans
    .map((span) => ({ ...span, to: Math.min(span.to, end) }))
    .filter((span) => span.from < span.to);
}

const within = (spans, at) => spans.some((s) => s.from <= at && at < s.to);

/**
 * The versions an item published, each as a change: `created` for its first,
 * `updated` for the others, from the version it replaced.
 *
 * @param {Object} item the stored skill or expertise
 * @param {{ everyAudience: boolean }} reader whether the reader sees every
 *   audience (the platform company)
 * @returns {Array<{ change, at, from, version }>}
 */
function publicationChanges(item, { everyAudience }) {
  const spans = everyAudience ? null : openSpans(item);
  return publications(item)
    .map((version, index, all) => ({
      change: index === 0 ? 'created' : 'updated',
      at: time(version.activatedAt),
      from: index === 0 ? null : all[index - 1],
      version,
    }))
    .filter(({ at }) => everyAudience || within(spans, at));
}

/**
 * What a reader is answered of a change: a client company its release note,
 * the platform company the changelog too, a super admin the retex the
 * version addressed.
 */
function asChange(kind, item, found, reader) {
  const { version, from } = found;
  return {
    kind,
    id: item.id,
    title: item.title,
    category: item.category,
    change: found.change,
    at: isoOf(found.at),
    fromVersion: from ? versionLabel(from) : null,
    toVersion: versionLabel(version),
    releaseNote: releaseNoteOf(version),
    ...(reader.everyAudience && { changeLog: changeLogOf(version) }),
    ...(reader.consultant && {
      addressesRetex: (version.retexIds || []).map(String),
    }),
    ...(reader.everyAudience && { audience: item.audience }),
    ...(item.uri && { uri: item.uri }),
  };
}

/**
 * The changes of an item a reader sees, in a period.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} item the stored item, with its `id` and, when the reader
 *   may read it now, its `uri`
 * @param {{ everyAudience: boolean, consultant: boolean }} reader
 * @param {{ since: number, until: number }} period in milliseconds, inclusive
 */
function changesOf(kind, item, reader, { since, until }) {
  return publicationChanges(item, reader)
    .filter(({ at }) => at >= since && at <= until)
    .map((found) => asChange(kind, item, found, reader));
}

module.exports = { changesOf, openSpans, publications };
