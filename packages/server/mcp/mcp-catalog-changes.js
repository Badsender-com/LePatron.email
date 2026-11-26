'use strict';

/**
 * The catalog changes of an item, as a company sees them (ADR 0031): each
 * version published, created or updated, dated by its publication; each
 * opening to every company and each withdrawal, by its audience history,
 * archivings and republications included (`audience-spans.js`). A company other than the platform company sees an item only
 * while it was open to every company: its opening is when the item appears,
 * created, after a withdrawal too; a version published while the
 * item was kept to the platform company is never one of its changes.
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
const {
  audienceSteps,
  openSpans,
} = require('../ai-skill/services/audience-spans.js');
const { isoOf } = require('./mcp-catalog-dates.js');

const time = (date) => new Date(date).getTime();

/** The versions of an item ever published, the first first. */
function publications(item) {
  return (item.versions || [])
    .filter((version) => version.activatedAt)
    .sort((a, b) => time(a.activatedAt) - time(b.activatedAt));
}

// A version published as the item opened is told by the opening.
const within = (spans, at) => spans.some((s) => s.from < at && at < s.to);

// The version an item was at, at a date: the last published by then.
function versionAt(item, at) {
  const before = publications(item).filter((v) => time(v.activatedAt) <= at);
  return before.length ? before[before.length - 1] : null;
}

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
 * What the platform company is told of a step of the history: a change of
 * audience while the item is not archived, an archiving, and a
 * republication of an item open to every company.
 */
function platformChangeOf({ archiving, before, after }) {
  if (archiving) {
    if (after.archived) return 'withdrawn';
    return after.audience === Audiences.ALL ? 'opened' : null;
  }
  if (before.archived) return null;
  return after.audience === Audiences.ALL ? 'opened' : 'withdrawn';
}

/**
 * The openings and withdrawals a reader sees: the platform company each
 * change of audience and each archiving; another company the start of each
 * span it was open to it, as a creation, and each end: it never learns that
 * an item existed before it was opened, nor that it was opened again.
 */
function audienceChanges(item, { everyAudience }) {
  if (everyAudience) {
    return audienceSteps(item)
      .steps.map((step) => ({ change: platformChangeOf(step), at: step.at }))
      .filter(({ change }) => change)
      .map((found) => ({ ...found, version: versionAt(item, found.at) }));
  }
  return openSpans(item).flatMap((span) => [
    ...(span.from > -Infinity && versionAt(item, span.from)
      ? [
          {
            change: 'created',
            at: span.from,
            version: versionAt(item, span.from),
          },
        ]
      : []),
    ...(span.to < Infinity ? [{ change: 'withdrawn', at: span.to }] : []),
  ]);
}

// A withdrawn item is told by its title alone: it may no longer be read.
function asWithdrawal(kind, item, { at }) {
  return {
    kind,
    id: item.id,
    title: item.title,
    change: 'withdrawn',
    at: isoOf(at),
  };
}

// An opening says the version opened, and no release note: none was
// written for it.
function asOpening(kind, item, found, reader) {
  return {
    kind,
    id: item.id,
    title: item.title,
    category: item.category,
    change: found.change,
    at: isoOf(found.at),
    fromVersion: null,
    toVersion: found.version ? versionLabel(found.version) : null,
    releaseNote: null,
    ...(reader.everyAudience && { audience: item.audience }),
    ...(item.uri && { uri: item.uri }),
  };
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
  const inPeriod = ({ at }) => at >= since && at <= until;
  return [
    ...publicationChanges(item, reader)
      .filter(inPeriod)
      .map((found) => asChange(kind, item, found, reader)),
    ...audienceChanges(item, reader)
      .filter(inPeriod)
      .map((found) =>
        found.change === 'withdrawn'
          ? asWithdrawal(kind, item, found)
          : asOpening(kind, item, found, reader)
      ),
  ];
}

module.exports = { changesOf, publications };
