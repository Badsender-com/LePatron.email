'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const expertiseRepo = require('../../ai-skill/repositories/expertise.repository.js');
const { VersionRefModes } = require('../constant/playground-constants.js');

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
  const hasFilter =
    (Array.isArray(filter.scope) && filter.scope.length > 0) ||
    filter.emailType ||
    filter.language;
  if (hasFilter) {
    return expertiseRepo.findApplicable({
      scope: filter.scope && filter.scope.length ? filter.scope : undefined,
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
    out.push({
      expertiseId: doc.expertiseId,
      title: doc.title,
      category: doc.category,
      scope: doc.scope,
      versionMajor: version.versionMajor,
      versionMinor: version.versionMinor,
      body: version.body,
      examplesGood: version.examplesGood || [],
      examplesBad: version.examplesBad || [],
      sections: version.sections || [],
    });
  }
  return out;
}

function pickVersion(doc, ref) {
  if (ref.mode === VersionRefModes.PINNED) {
    return (doc.versions || []).find(
      (v) =>
        v.versionMajor === ref.versionMajor &&
        v.versionMinor === (ref.versionMinor || 0)
    );
  }
  // active mode
  const av = doc.activeVersion || {};
  if (av.major == null) return null;
  return (doc.versions || []).find(
    (v) => v.versionMajor === av.major && v.versionMinor === (av.minor || 0)
  );
}

module.exports = { resolveExpertise };
