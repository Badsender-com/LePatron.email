'use strict';

/**
 * Runtime registry of feature skill-manifests.
 *
 * Each feature owns a `skill-manifest.js` (cf. docs/AI_SKILL_AUTHORING.md)
 * declaring the skills/expertise it uses AND, optionally, the findApplicable
 * filters it issues (`expertiseFilters`). This module loads the known
 * manifests at require-time — one explicit require per manifest, no glob
 * magic: the set of features is small and adding one is a deliberate act.
 *
 * It exists to power the activation-impact alert: when a super-admin activates
 * an expertise, we confront the expertise's scope/category/emailType against
 * every declared expertiseFilter and surface which features will load it.
 */

// One explicit require per known manifest. Wrapped so a feature module that is
// absent on a given branch (e.g. the POC manifest only lives on poc/ai-textgen)
// does not break the registry.
function safeRequire(path) {
  try {
    // eslint-disable-next-line global-require, import/no-dynamic-require
    return require(path);
  } catch (err) {
    // Only "the file is not on this branch" is tolerated. Swallowing anything
    // else would let a SyntaxError in an EXISTING manifest silently disable the
    // activation-impact alert instead of failing loudly at boot.
    const isMissingThisModule =
      err.code === 'MODULE_NOT_FOUND' && err.message.includes(path);
    if (!isMissingThisModule) throw err;
    return null;
  }
}

const MANIFESTS = [
  safeRequire('../../translation/skill-manifest.js'),
  safeRequire('../../email-builder/skill-manifest.js'),
].filter(Boolean);

function listManifests() {
  return MANIFESTS;
}

/**
 * Does a declared expertiseFilter load an expertise with these attributes?
 * Mirror of findApplicable's matching, seen from the expertise side:
 *   - category ∈ filter.categories
 *   - AND ( expertise transversal  OR  expertise.scope ∩ filter.scope ≠ ∅ )
 *   - AND ( filter has no emailType  OR  expertise loads all email types
 *           OR emailType ∈ expertise.appliesToEmailTypes )
 */
function filterMatchesExpertise(filter, expertise) {
  const filterCategories = Array.isArray(filter.categories)
    ? filter.categories
    : [];
  if (!filterCategories.includes(expertise.category)) return false;

  const filterScopes = Array.isArray(filter.scope)
    ? filter.scope
    : filter.scope
    ? [filter.scope]
    : [];
  const expScopes = Array.isArray(expertise.scope) ? expertise.scope : [];
  const scopeMatches =
    expertise.isTransversal || filterScopes.some((s) => expScopes.includes(s));
  if (!scopeMatches) return false;

  if (filter.emailType) {
    const expEmailTypes = Array.isArray(expertise.appliesToEmailTypes)
      ? expertise.appliesToEmailTypes
      : [];
    // Empty on the expertise means "all email types".
    if (expEmailTypes.length && !expEmailTypes.includes(filter.emailType)) {
      return false;
    }
  }
  return true;
}

/**
 * Compute the "radius of impact" of an expertise: the features whose declared
 * filters would load it.
 *
 * @param {Object} expertise — { category, scope[], isTransversal, appliesToEmailTypes[] }
 * @returns {Array<{ featureType: string, description: string, matchedFilter: Object }>}
 */
function computeActivationImpact(expertise) {
  const matches = [];
  for (const manifest of MANIFESTS) {
    for (const filter of manifest.expertiseFilters || []) {
      if (filterMatchesExpertise(filter, expertise)) {
        matches.push({
          featureType: manifest.featureType,
          description: manifest.description || manifest.featureType,
          matchedFilter: filter,
        });
        break; // one match per feature is enough to surface it
      }
    }
  }
  return matches;
}

module.exports = {
  listManifests,
  computeActivationImpact,
  filterMatchesExpertise,
};
