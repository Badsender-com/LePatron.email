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
const { findActiveVersion } = require('../services/version-helpers.js');

// What `published` reads, whatever the caller asks for.
const DOC_FIELDS = ['status', 'activeVersion'];
const VERSION_FIELDS = ['versionMajor', 'versionMinor', 'status'];

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

/**
 * The published items a filter matches, each with its active version only.
 *
 * @param {Model} Model `LePatronSkills` or `Expertises`
 * @param {Object} filter which items, their status aside; plain values only,
 *   since an aggregation casts nothing
 * @param {Object} fields
 * @param {string[]} fields.doc the fields read of each item
 * @param {string[]} fields.version the fields read of its active version
 * @returns {Promise<Array<{ doc: Object, version: Object }>>}
 */
async function findPublished(Model, filter, fields) {
  const docs = await Model.aggregate([
    { $match: { ...filter, status: SkillStatuses.ACTIVE } },
    { $unwind: '$versions' },
    // One version is ACTIVE at a time (versioned-entity.service.js), the one
    // `activeVersion` points at, which `published` checks again.
    { $match: { 'versions.status': SkillStatuses.ACTIVE } },
    {
      $project: {
        ...included([...DOC_FIELDS, ...fields.doc]),
        ...included([...VERSION_FIELDS, ...fields.version], 'versions.'),
      },
    },
  ]);
  return docs
    .map(({ versions, ...doc }) => published({ ...doc, versions: [versions] }))
    .filter(Boolean);
}

module.exports = { published, findPublished };
