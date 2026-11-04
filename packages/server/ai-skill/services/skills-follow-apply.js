'use strict';

/**
 * What following production does to one skill or expertise of a copy
 * (ADR 0019), worked out without writing: the fields the copy takes, or why
 * it keeps its own.
 *
 * - Production's active version arrives active, the copy's former one is
 *   archived; production's open draft arrives a draft.
 * - The state, the audience and the served-to-assistants mark are
 *   production's.
 * - No version goes back: an item whose active version is ahead of
 *   production's is kept as it is.
 * - A local draft newer than production's is never overwritten.
 */

const { findActiveVersion, openDraftOf } = require('./version-helpers.js');
const skillService = require('./skill.service.js');
const expertiseService = require('./expertise.service.js');

const CONTENT_FIELDS = {
  expertise: expertiseService.VERSION_CONTENT_FIELDS,
  skill: skillService.VERSION_CONTENT_FIELDS,
};
const IDENTITY_FIELDS = {
  expertise: [
    'title',
    'description',
    'category',
    'scope',
    'isTransversal',
    'appliesToEmailTypes',
    'appliesToLanguages',
  ],
  // A skill's nature is its versions' (ADR 0013): it comes with them.
  skill: ['title', 'description', 'category', 'servedToAssistants'],
};

const copy = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

// -1, 0 or 1 as version `a` stands to version `b`, both stored versions.
function compare(a, b) {
  if (a.versionMajor !== b.versionMajor) {
    return a.versionMajor > b.versionMajor ? 1 : -1;
  }
  if (a.versionMinor === b.versionMinor) return 0;
  return a.versionMinor > b.versionMinor ? 1 : -1;
}

const numberOf = ({ major, minor }) => ({
  versionMajor: major,
  versionMinor: minor,
});
const sameNumber = (a, b) => compare(a, b) === 0;

// The content a version holds, as production answered it.
function contentOf(kind, answered) {
  const content = {};
  CONTENT_FIELDS[kind].forEach(({ name, default: empty }) => {
    const value = answered[name];
    content[name] = value === undefined || value === null ? empty() : value;
  });
  content.changelog = answered.changelog || '';
  content.releaseNotes = answered.releaseNotes || '';
  return copy(content);
}

// Production's version, written over the copy's one of the same number, or
// added; its history on the copy (creation) is kept.
function place(kind, versions, answered, status, now) {
  const number = numberOf(answered);
  const index = versions.findIndex((v) => sameNumber(v, number));
  const previous = index === -1 ? { createdAt: now } : versions[index];
  const version = {
    ...previous,
    ...number,
    ...contentOf(kind, answered),
    status,
    updatedAt: now,
  };
  if (status === 'ACTIVE' && !previous.activatedAt) version.activatedAt = now;
  if (index === -1) versions.push(version);
  else versions.splice(index, 1, version);
}

/**
 * The document a copy holds for an item production answered, once followed.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} item the item as production answered it
 * @param {Object|null} doc the copy's document, lean, or null
 * @param {Date} now
 * @returns {{ kept: string } | { fields: Object }} `kept` with its reason, or
 *   the fields to write
 */
function followedItem(kind, item, doc, now) {
  const versions = copy((doc && doc.versions) || []);
  const local = doc && findActiveVersion(doc);
  let activeVersion = (doc && copy(doc.activeVersion)) || {
    major: null,
    minor: 0,
  };

  if (local && (!item.version || compare(local, numberOf(item.version)) > 0)) {
    return { kept: 'copy_newer' };
  }
  if (item.version) {
    if (local && !sameNumber(local, numberOf(item.version))) {
      versions.find((v) => sameNumber(v, local)).status = 'ARCHIVED';
    }
    place(kind, versions, item.version, 'ACTIVE', now);
    activeVersion = { major: item.version.major, minor: item.version.minor };
  }
  if (item.draft) {
    const followed = { versions, activeVersion };
    const active = findActiveVersion(followed);
    const draft = numberOf(item.draft);
    const ahead = !active || compare(draft, active) > 0;
    const open = openDraftOf(followed);
    if (ahead && (!open || compare(open, draft) <= 0)) {
      place(kind, versions, item.draft, 'DRAFT', now);
    }
  }

  const fields = {
    status: String(item.status).toUpperCase(),
    audience: item.audience,
    activeVersion,
    versions,
  };
  IDENTITY_FIELDS[kind].forEach((field) => {
    if (item[field] !== undefined) fields[field] = copy(item[field]);
  });
  return { fields };
}

// What a follow compares to tell an item that changed from one already up
// to date: the fields it writes, without the dates it stamps.
function signatureOf(kind, fields) {
  const versionFields = [
    'versionMajor',
    'versionMinor',
    'status',
    'changelog',
    'releaseNotes',
    ...CONTENT_FIELDS[kind].map(({ name }) => name),
  ];
  return JSON.stringify([
    ...['status', 'audience', 'activeVersion', ...IDENTITY_FIELDS[kind]].map(
      (field) => fields[field] ?? null
    ),
    (fields.versions || []).map((version) =>
      versionFields.map((field) => version[field] ?? null)
    ),
  ]);
}

module.exports = { followedItem, signatureOf };
