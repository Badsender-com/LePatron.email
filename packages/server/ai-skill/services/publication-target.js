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
  return { doc, manifests: manifestsUsing(kind, doc) };
}

module.exports = { ID_FIELDS, MODELS, loadUse };
