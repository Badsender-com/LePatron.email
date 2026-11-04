'use strict';

/**
 * Which features use a skill or an expertise, from the features' own skill
 * manifests (ADR 0019): the skills a feature calls (`usedSkills`), the
 * expertises it loads by name (`usedExpertise`) and through its declared
 * filters (`expertiseFilters`). Pure: the manifests are in memory.
 */

const { SkillStatuses } = require('../constant/skill-constants.js');
const manifestRegistry = require('./manifest-registry.js');

const KINDS = ['skill', 'expertise'];

function asList(value) {
  return Array.isArray(value) ? value : [];
}

function declaresUse(manifest, kind, entity) {
  if (kind === 'skill') {
    return asList(manifest.usedSkills).includes(entity.skillId);
  }
  if (asList(manifest.usedExpertise).includes(entity.expertiseId)) {
    return true;
  }
  // Only a stored expertise has the attributes a filter is matched against.
  if (!entity.category) return false;
  return asList(manifest.expertiseFilters).some((filter) =>
    manifestRegistry.filterMatchesExpertise(filter, entity)
  );
}

/**
 * The manifests of the features that use a skill or an expertise. A feature
 * loads only active expertises, and calls no archived skill.
 */
function manifestsUsing(kind, entity) {
  if (!KINDS.includes(kind) || !entity) return [];
  if (entity.status === SkillStatuses.ARCHIVED) return [];
  return manifestRegistry
    .listManifests()
    .filter((manifest) => declaresUse(manifest, kind, entity));
}

function describeFeature(manifest) {
  return {
    featureType: manifest.featureType,
    description: manifest.description || manifest.featureType,
  };
}

module.exports = { asList, declaresUse, manifestsUsing, describeFeature };
