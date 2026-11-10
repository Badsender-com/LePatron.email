'use strict';

/**
 * What a publication is about (ADR 0019): the stored skill or expertise, the
 * version asked for, and the features that use it. Shared by the publication
 * of one version and by the batch.
 */

const createError = require('http-errors');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
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
  if (!ID_FIELDS[kind]) throw createError(400, `Unknown kind "${kind}"`);
  const doc = await MODELS[kind].findOne({ [ID_FIELDS[kind]]: id }).lean();
  if (!doc) throw createError(404, `${kind} "${id}" not found`);
  if (!findVersion(doc, version.major, version.minor)) {
    throw createError(
      404,
      `Version ${version.major}.${version.minor} not found`
    );
  }
  return { doc, manifests: manifestsUsing(kind, doc) };
}

module.exports = { ID_FIELDS, MODELS, loadUse };
