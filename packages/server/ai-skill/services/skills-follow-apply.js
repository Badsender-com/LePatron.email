'use strict';

/**
 * What following production does to one skill or expertise of a copy
 * (ADR 0019), worked out without writing.
 *
 * - An item that came from production follows it in everything: its active
 *   version and its open draft at production's numbers, its state, its
 *   audience, its served-to-assistants mark and what it is. Each version a
 *   follow brings is marked (`followedAt`).
 * - What the copy wrote is never lost. A version the copy wrote, or
 *   received and then changed, leaves the item for a new item of the copy,
 *   which no follow touches, when production would replace it: its draft,
 *   when production brings one or publishes at or past its number, a
 *   version of the number production brings, and the version the copy
 *   published.
 * - A draft the copy received, which production no longer has, is removed.
 * - An item kept on the copy is not touched; the follow says whether
 *   production changed since the copy last followed it.
 */

const crypto = require('crypto');
const { isDeepStrictEqual } = require('util');
const {
  compareVersions,
  findActiveVersion,
  laterThan,
  versionLabel,
} = require('./version-helpers.js');
const { ENTITIES, contentOf } = require('./skills-export.service.js');
const { SkillStatuses } = require('../constant/skill-constants.js');

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

const numberOf = ({ major, minor }) => ({
  versionMajor: major,
  versionMinor: minor,
});
const sameNumber = (a, b) => compareVersions(a, b) === 0;

// What a version says, its release notes included, whatever its form: as
// stored, or as production answered it.
const releasedContentOf = (kind, version) => ({
  ...contentOf(version, ENTITIES[kind].contentFields),
  changelog: version.changelog || '',
  releaseNotes: version.releaseNotes || '',
});
const sameContent = (kind, a, b) =>
  isDeepStrictEqual(releasedContentOf(kind, a), releasedContentOf(kind, b));

const time = (date) => (date ? new Date(date).getTime() : 0);

// A field that says nothing: as production leaves it out of its answer, or
// as the model gives it by default.
const isEmpty = (value) =>
  value === undefined ||
  value === null ||
  value === '' ||
  value === false ||
  (Array.isArray(value) && !value.length);

/**
 * Whether the copy wrote this version: never brought by a follow, or
 * changed or published on the copy since a follow brought it.
 *
 * @param {Object} version as stored
 * @returns {boolean}
 */
const isCopyWork = (version) =>
  !version.followedAt ||
  time(version.updatedAt) > time(version.followedAt) ||
  time(version.activatedAt) > time(version.followedAt);

// A JSON with its keys in order, whatever order an object holds them in.
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .filter((key) => value[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

/**
 * Production's item, as a digest: what tells an item kept on the copy
 * whether production changed since the copy last followed it.
 *
 * @param {Object} item as production answered it
 * @returns {string}
 */
const digestOf = (item) =>
  crypto.createHash('sha256').update(canonical(item)).digest('hex');

// The versions production brings, with the status each arrives at.
const incomingOf = (item) =>
  [
    item.version && { answered: item.version, status: SkillStatuses.ACTIVE },
    item.draft && { answered: item.draft, status: SkillStatuses.DRAFT },
  ].filter(Boolean);

// Whether production's version, arriving at `status`, is the stored one as
// a follow left it.
const alreadyFollowed = (kind, stored, { answered, status }) =>
  !!stored &&
  !isCopyWork(stored) &&
  stored.status === status &&
  sameContent(kind, stored, answered);

// Whether a version the copy wrote leaves the item: when production would
// write over it, or leave it behind. One the copy published, which
// production holds as a draft, would go back to a draft: it leaves too.
function leaves(kind, version, item, { localActive }) {
  const incoming = incomingOf(item).find(({ answered }) =>
    sameNumber(version, numberOf(answered))
  );
  if (incoming) {
    return (
      !sameContent(kind, version, incoming.answered) ||
      (version.status !== SkillStatuses.DRAFT &&
        incoming.status === SkillStatuses.DRAFT)
    );
  }
  if (version === localActive) return true;
  if (version.status !== SkillStatuses.DRAFT) return false;
  return (
    !!item.draft ||
    (!!item.version && compareVersions(numberOf(item.version), version) >= 0)
  );
}

// Production's version, written over the copy's one of the same number, or
// added, marked as followed. Its creation on the copy is kept.
function place(kind, versions, incoming, now) {
  const { answered, status } = incoming;
  const number = numberOf(answered);
  const index = versions.findIndex((v) => sameNumber(v, number));
  const previous = index === -1 ? null : versions[index];
  if (alreadyFollowed(kind, previous, incoming)) return;
  const at = laterThan(previous && previous.updatedAt, now);
  const version = {
    ...(previous || { createdAt: at }),
    ...number,
    ...copy(releasedContentOf(kind, answered)),
    status,
    updatedAt: at,
    followedAt: at,
  };
  if (status === SkillStatuses.ACTIVE && (!previous || !previous.activatedAt)) {
    version.activatedAt = at;
  }
  if (index === -1) versions.push(version);
  else versions.splice(index, 1, version);
}

// What a follow compares to tell an item that changed from one up to date:
// the fields it writes, not the dates it stamps.
function signatureOf(kind, fields) {
  const versionFields = [
    'versionMajor',
    'versionMinor',
    'status',
    'changelog',
    'releaseNotes',
    ...ENTITIES[kind].contentFields.map(({ name }) => name),
  ];
  return JSON.stringify([
    ...[
      'status',
      'audience',
      'activeVersion',
      'followedDigest',
      ...IDENTITY_FIELDS[kind],
    ].map((field) => fields[field] ?? null),
    (fields.versions || []).map((version) => [
      ...versionFields.map((field) => version[field] ?? null),
      isCopyWork(version),
    ]),
  ]);
}

/**
 * What a follow does to an item production answered.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} item the item as production answered it
 * @param {Object|null} doc the copy's item, plain, or null
 * @param {Date} now
 * @returns {Object} `outcome`: `kept` (with `reason` and
 *   `productionChanged`), `upToDate`, or `created` / `updated` with the
 *   `fields` to write, the fields production no longer has (`unset`), the
 *   versions of the copy's own work that leave it (`moved`) and the numbers
 *   of the drafts removed (`removed`)
 */
function followedItem(kind, item, doc, now) {
  const followedDigest = digestOf(item);
  if (doc && doc.keptOnCopy) {
    return {
      outcome: 'kept',
      reason: 'kept_on_copy',
      productionChanged: doc.followedDigest !== followedDigest,
    };
  }
  const stored = copy((doc && doc.versions) || []);
  const localActive = doc && findActiveVersion({ ...doc, versions: stored });
  const moved = [];
  const removed = [];
  const versions = stored.filter((version) => {
    if (isCopyWork(version)) {
      if (!leaves(kind, version, item, { localActive })) return true;
      moved.push(version);
      return false;
    }
    const brought = incomingOf(item).some(({ answered }) =>
      sameNumber(version, numberOf(answered))
    );
    if (brought || version.status !== SkillStatuses.DRAFT) return true;
    removed.push(versionLabel(version));
    return false;
  });
  // The copy's active version, which production does not keep active.
  versions.forEach((version) => {
    if (
      version.status === SkillStatuses.ACTIVE &&
      !(item.version && sameNumber(version, numberOf(item.version)))
    ) {
      // eslint-disable-next-line no-param-reassign
      version.status = SkillStatuses.ARCHIVED;
    }
  });
  incomingOf(item).forEach((incoming) => place(kind, versions, incoming, now));

  const fields = {
    status: String(item.status).toUpperCase(),
    audience: item.audience,
    activeVersion: item.version
      ? { major: item.version.major, minor: item.version.minor }
      : { major: null, minor: 0 },
    versions,
    followedDigest,
  };
  IDENTITY_FIELDS[kind].forEach((field) => {
    if (item[field] !== undefined) fields[field] = copy(item[field]);
  });
  // What production no longer says of the item, the copy no longer says.
  const unset = doc
    ? IDENTITY_FIELDS[kind].filter(
        (field) => item[field] === undefined && !isEmpty(doc[field])
      )
    : [];
  const followed = { ...doc, ...fields };
  unset.forEach((field) => delete followed[field]);
  if (
    doc &&
    !moved.length &&
    !removed.length &&
    signatureOf(kind, doc) === signatureOf(kind, followed)
  ) {
    return { outcome: 'upToDate' };
  }
  return {
    outcome: doc ? 'updated' : 'created',
    fields: { ...fields, followedAt: now },
    unset,
    moved,
    removed,
  };
}

/**
 * What a follow does to an item of the copy production no longer answers.
 * An item the copy wrote, or kept, stays; one a follow brought and that
 * production never published is removed, the copy's own work on it leaving
 * for a new item first.
 *
 * @param {Object} doc the copy's item, plain
 * @returns {Object} `outcome`: `kept` (with `reason`, and
 *   `productionChanged` for an item kept on the copy), or `removed` with the
 *   versions of the copy's work that leave it (`moved`)
 */
function withdrawnItem(doc) {
  if (doc.keptOnCopy) {
    return { outcome: 'kept', reason: 'kept_on_copy', productionChanged: true };
  }
  const versions = doc.versions || [];
  const published = versions.some(
    (version) => !isCopyWork(version) && version.status !== SkillStatuses.DRAFT
  );
  if (!doc.followedAt || published) {
    return { outcome: 'kept', reason: 'local_only' };
  }
  return { outcome: 'removed', moved: copy(versions.filter(isCopyWork)) };
}

module.exports = {
  IDENTITY_FIELDS,
  followedItem,
  withdrawnItem,
  isCopyWork,
  digestOf,
};
