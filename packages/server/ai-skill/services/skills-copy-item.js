'use strict';

/**
 * An item of the copy holding another item's versions (ADR 0019): the
 * copy's own work a follow moves out of an item that follows production, or
 * a version a person duplicates to try it. Worked out without writing; its
 * id is the other item's, suffixed, so the two read side by side.
 */

const { compareVersions, laterThan } = require('./version-helpers.js');
const { ENTITIES } = require('./skills-export.service.js');
const { IDENTITY_FIELDS } = require('./skills-follow-apply.js');
const {
  SkillStatuses,
  Audiences,
  MaxSkillIdLength,
} = require('../constant/skill-constants.js');

// Stored content, said in French as every content of a skill is (ADR 0013):
// the title of an item holding the copy's own work.
const COPY_WORK_TITLE = ' (travail de la copie)';
const COPY_ID_SUFFIX = '.copie';

const copy = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/**
 * The id of the item that holds the copy's own work on `id`: the `n`th one,
 * within the length an id may have.
 *
 * @param {string} id
 * @param {number} n from 1
 * @returns {string}
 */
function copyIdOf(id, n) {
  const suffix = n === 1 ? COPY_ID_SUFFIX : `${COPY_ID_SUFFIX}-${n}`;
  return `${id.slice(0, MaxSkillIdLength - suffix.length)}${suffix}`;
}

/**
 * A new item of the copy holding versions of another one: the copy's own
 * work a follow moves out, or a version duplicated to try it. Its latest
 * version is its draft, the others its history; it is kept to the platform
 * company, served to no assistant, and no follow touches it.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} doc the item the versions come from, plain
 * @param {Object[]} versions as stored
 * @param {Object} options
 * @param {string} options.id the new item's id (copyIdOf)
 * @param {Date} options.now
 * @param {*} [options.owner]
 * @returns {Object} the new item's fields
 */
function copyItemOf(kind, doc, versions, { id, now, owner }) {
  const { idField } = ENTITIES[kind];
  const sorted = copy(versions).sort(compareVersions);
  const last = sorted.length - 1;
  const fields = {
    [idField]: id,
    status: SkillStatuses.DRAFT,
    audience: Audiences.PLATFORM,
    activeVersion: { major: null, minor: 0 },
    copiedFrom: doc[idField],
    owner,
    versions: sorted.map(({ followedAt: _followed, ...version }, index) => ({
      ...version,
      status: index === last ? SkillStatuses.DRAFT : SkillStatuses.ARCHIVED,
      activatedAt: index === last ? null : version.activatedAt || null,
      updatedAt: laterThan(version.updatedAt, now),
    })),
  };
  IDENTITY_FIELDS[kind].forEach((field) => {
    if (doc[field] !== undefined) fields[field] = copy(doc[field]);
  });
  fields.title = `${doc.title}${COPY_WORK_TITLE}`;
  if (kind === 'skill') fields.servedToAssistants = false;
  return fields;
}

module.exports = { copyIdOf, copyItemOf };
