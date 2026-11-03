'use strict';

/**
 * What leaves LePatron of a skill or an expertise (ADR 0012, ADR 0013): the
 * active version of an active item. Drafts and archives never do, nor an item
 * without an active version. One definition, read by the MCP server.
 *
 * A published item is read in one query that keeps its active version alone,
 * with the fields the caller names: never the history of its versions, never
 * a skill's test cases. An aggregation, since a find projection cannot both
 * keep one element of `versions` and leave out some of its fields on MongoDB
 * 3.4, the oldest version LePatron supports.
 */

const { SkillStatuses } = require('../constant/skill-constants.js');
const {
  findActiveVersion,
  openDraftOf,
} = require('../services/version-helpers.js');

// What `published` reads, whatever the caller asks for.
const DOC_FIELDS = ['status', 'activeVersion'];
const VERSION_FIELDS = ['versionMajor', 'versionMinor', 'status'];
// What never leaves, whatever the caller asks for: a skill's test cases carry
// the briefs its authors tried, and the whole history of its versions.
const NEVER_READ = new Set(['testCases', 'versions']);
const readable = (names) =>
  names.filter((name) => !NEVER_READ.has(name.split('.')[0]));

/**
 * @param {Object} [doc] a skill or an expertise, with all its versions or its
 *   active one only
 * @returns {{ doc: Object, version: Object }|null} the item and its active
 *   version, when it is published
 */
function published(doc) {
  if (!doc || doc.status !== SkillStatuses.ACTIVE) return null;
  const version = findActiveVersion(doc);
  if (!version || version.status !== SkillStatuses.ACTIVE) return null;
  return { doc, version };
}

const included = (names, prefix = '') =>
  Object.fromEntries(names.map((name) => [`${prefix}${name}`, 1]));

const projection = (fields) => ({
  ...included([...DOC_FIELDS, ...readable(fields.doc)]),
  ...included([...VERSION_FIELDS, ...readable(fields.version)], 'versions.'),
});

/**
 * The published items a filter matches, each with its active version only.
 *
 * @param {Model} Model `LePatronSkills` or `Expertises`
 * @param {Object} filter which items, their status aside; plain values only,
 *   since an aggregation casts nothing
 * @param {Object} fields
 * @param {string[]} fields.doc the fields read of each item
 * @param {string[]} fields.version the fields read of its active version;
 *   `testCases` never is, even when named
 * @returns {Promise<Array<{ doc: Object, version: Object }>>}
 */
async function findPublished(Model, filter, fields) {
  const docs = await Model.aggregate([
    { $match: { ...filter, status: SkillStatuses.ACTIVE } },
    { $unwind: '$versions' },
    // One version is ACTIVE at a time (versioned-entity.service.js), the one
    // `activeVersion` points at, which `published` checks again.
    { $match: { 'versions.status': SkillStatuses.ACTIVE } },
    { $project: projection(fields) },
  ]);
  return docs
    .map(({ versions, ...doc }) => published({ ...doc, versions: [versions] }))
    .filter(Boolean);
}

// What a super admin trying the drafts reads of an item (ADR 0014, #1385).
const TRIED = [SkillStatuses.ACTIVE, SkillStatuses.DRAFT];

/**
 * The version an item is served at in drafts mode: its open draft when it
 * has one, never one left behind by a later publication, else its active
 * version. An archived item never is.
 *
 * @param {Object} doc an item, with its active version and its drafts
 * @returns {{ doc: Object, version: Object, draft: boolean }|null}
 */
function tried(doc) {
  const draft = openDraftOf(doc);
  if (draft) return { doc, version: draft, draft: true };
  const found = published(doc);
  return found && { ...found, draft: false };
}

/**
 * The items a filter matches, each at the version it is served at: its
 * active version, or in drafts mode its open draft when it has one (ADR 0014,
 * #1385), an item never published included. Read as `findPublished` reads
 * them, with the drafts as well as the active version in drafts mode: never
 * the archived versions, never a skill's test cases.
 *
 * @param {Model} Model `LePatronSkills` or `Expertises`
 * @param {Object} filter which items, their status aside; plain values only
 * @param {Object} fields as `findPublished` takes them
 * @param {Object} [options]
 * @param {boolean} [options.drafts] whether the caller tries the drafts
 * @returns {Promise<Array<{ doc: Object, version: Object, draft: boolean }>>}
 */
async function findServed(Model, filter, fields, { drafts = false } = {}) {
  if (!drafts) {
    const found = await findPublished(Model, filter, fields);
    return found.map((item) => ({ ...item, draft: false }));
  }
  const rows = await Model.aggregate([
    { $match: { ...filter, status: { $in: TRIED } } },
    { $unwind: '$versions' },
    { $match: { 'versions.status': { $in: TRIED } } },
    { $project: projection(fields) },
  ]);
  // One row per version read: put back together, item by item, in order.
  const items = new Map();
  rows.forEach(({ versions, ...doc }) => {
    const key = String(doc._id);
    if (!items.has(key)) items.set(key, { ...doc, versions: [] });
    items.get(key).versions.push(versions);
  });
  return [...items.values()].map(tried).filter(Boolean);
}

module.exports = { published, findPublished, findServed };
