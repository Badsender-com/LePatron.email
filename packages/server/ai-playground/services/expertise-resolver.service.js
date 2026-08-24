'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const expertiseRepo = require('../../ai-skill/repositories/expertise.repository.js');
const { VersionRefModes } = require('../constant/playground-constants.js');
const {
  findVersion,
  findActiveVersion,
} = require('../../ai-skill/services/version-helpers.js');

/**
 * Resolve the expertise list a scenario should inject into the skill input.
 *
 * Three modes:
 *  - explicit  → fetch each item in scenario.expertiseRefs, hydrate the
 *                referenced version (active or pinned).
 *  - filter    → defer to expertiseRepo.findApplicable() with the scenario's
 *                expertiseFilter object.
 *  - none      → return an empty array. Legitimate case for skills that don't
 *                need expertise input.
 *
 * Priority: if expertiseRefs is non-empty, it wins over expertiseFilter.
 *
 * @param {Object} scenario — a hydrated AIPlaygroundScenario (or .toObject()).
 * @returns {Promise<Array<{expertiseId, title, body, examplesGood, examplesBad,
 *                          sections, versionMajor, versionMinor}>>}
 */
async function resolveExpertise(scenario) {
  if (Array.isArray(scenario.expertiseRefs) && scenario.expertiseRefs.length) {
    return resolveExplicit(scenario.expertiseRefs);
  }
  const filter = scenario.expertiseFilter || {};
  const hasScope = Array.isArray(filter.scope) && filter.scope.length > 0;
  const hasCategories =
    Array.isArray(filter.categories) && filter.categories.length > 0;
  // findApplicable requires BOTH scope and categories. A filter missing either
  // is treated as "no filter" (returns no expertise) rather than throwing —
  // same outcome as an empty filter today.
  if (hasScope && hasCategories) {
    return expertiseRepo.findApplicable({
      scope: filter.scope,
      categories: filter.categories,
      emailType: filter.emailType || undefined,
      language: filter.language || undefined,
    });
  }
  return [];
}

async function resolveExplicit(refs) {
  const docs = await Expertises.find({
    expertiseId: { $in: refs.map((r) => r.expertiseId) },
  }).lean();
  const byId = new Map(docs.map((d) => [d.expertiseId, d]));
  const out = [];
  for (const ref of refs) {
    const doc = byId.get(ref.expertiseId);
    if (!doc) {
      throw createError(
        404,
        `Expertise "${ref.expertiseId}" referenced by the scenario does not exist`
      );
    }
    const version = pickVersion(doc, ref);
    if (!version) {
      throw createError(
        404,
        `Version ${ref.versionMajor}.${ref.versionMinor} of expertise "${ref.expertiseId}" not found`
      );
    }
    // Same projection as the filter path: the shape an expertise takes is the
    // repository's business, only the CHOICE of version is the playground's.
    out.push(expertiseRepo.projectVersion(doc, version));
  }
  return out;
}

// Which version an explicit reference points at — the playground's policy,
// built on the shared version mechanics.
function pickVersion(doc, ref) {
  if (ref.mode === VersionRefModes.PINNED) {
    return findVersion(doc, ref.versionMajor, ref.versionMinor || 0);
  }
  return findActiveVersion(doc);
}

/**
 * The filter as the API receives it (query string or body): scalars may arrive
 * single or repeated, empties must not over-constrain. Lives here rather than
 * in the controller, which was reaching two layers down into
 * `ai-skill/repositories` with its own normalisation.
 */
function normaliseFilter(source = {}) {
  const toArray = (v) => (Array.isArray(v) ? v : v ? [v] : []);
  return {
    scope: toArray(source.scope),
    categories: toArray(source.categories),
    emailType: source.emailType || null,
    language: source.language || null,
  };
}

/**
 * Count and list the expertises a filter would inject — the live preview
 * behind the filter fields.
 *
 * Distinct from resolveExpertise on purpose: `findApplicable` throws 400 when
 * scope or categories is missing, and the preview WANTS that error (an
 * incomplete filter must not read as "0 matches"), where the runner treats the
 * same case as "no filter".
 */
async function previewFilter(source) {
  const filter = normaliseFilter(source);
  const matches = await expertiseRepo.findApplicable(filter);
  return {
    count: matches.length,
    items: matches.map((m) => ({
      expertiseId: m.expertiseId,
      title: m.title,
      versionMajor: m.versionMajor,
      versionMinor: m.versionMinor,
    })),
  };
}

module.exports = { resolveExpertise, previewFilter, normaliseFilter };
