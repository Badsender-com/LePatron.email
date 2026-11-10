'use strict';

/**
 * What a publication is about (ADR 0019): the stored skill or expertise, the
 * version asked for, and the features that use it. Shared by the publication
 * of one version and by the batch.
 */

const createError = require('http-errors');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const { manifestsUsing } = require('./feature-use.js');
const { findVersion } = require('./version-helpers.js');

const ID_FIELDS = { skill: 'skillId', expertise: 'expertiseId' };
const MODELS = { skill: LePatronSkills, expertise: Expertises };

const keyOf = ({ kind, id }) => `${kind}:${id}`;

// The features a publication of this item reaches.
const usesOf = (kind, doc) => manifestsUsing(kind, doc);

/**
 * The stored skill or expertise and the features that use it; the version
 * asked for must exist.
 *
 * @param {{ kind: 'skill'|'expertise', id: string,
 *   version: { major: number, minor: number } }} target
 * @returns {Promise<{ doc: Object, manifests: Object[] }>}
 */
async function loadUse({ kind, id, version }) {
  if (!ID_FIELDS[kind]) {
    throw createError(400, ERROR_CODES.SKILL_PUBLICATION_KIND_INVALID);
  }
  const doc = await MODELS[kind].findOne({ [ID_FIELDS[kind]]: id }).lean();
  if (!doc) {
    throw createError(404, ERROR_CODES.SKILL_PUBLICATION_ITEM_NOT_FOUND, {
      kind,
      id,
    });
  }
  if (!findVersion(doc, version.major, version.minor)) {
    throw createError(404, ERROR_CODES.SKILL_PUBLICATION_VERSION_NOT_FOUND, {
      id,
      version: `${version.major}.${version.minor}`,
    });
  }
  return { doc, manifests: usesOf(kind, doc) };
}

/**
 * The stored items of a selection, read with one query per kind.
 *
 * @param {Array<{ kind: string, id: string }>} items
 * @returns {Promise<Map<string, Object>>} by `kind:id` (keyOf); an item
 *   not stored, or of an unknown kind, is not in it
 */
async function loadMany(items) {
  const idsByKind = new Map();
  items
    .filter(({ kind }) => ID_FIELDS[kind])
    .forEach(({ kind, id }) =>
      idsByKind.set(kind, [...(idsByKind.get(kind) || []), id])
    );
  const found = new Map();
  await Promise.all(
    [...idsByKind].map(async ([kind, ids]) => {
      const idField = ID_FIELDS[kind];
      const docs = await MODELS[kind]
        .find({ [idField]: { $in: [...new Set(ids)] } })
        .lean();
      docs.forEach((doc) => found.set(keyOf({ kind, id: doc[idField] }), doc));
    })
  );
  return found;
}

module.exports = { keyOf, loadMany, loadUse, usesOf };
