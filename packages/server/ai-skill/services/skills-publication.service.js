'use strict';

/**
 * Publishing what a feature uses (ADR 0019, epic #1421).
 *
 * "Used by a feature" is worked out, never stored: a feature's skill manifest
 * names the skills it calls (`usedSkills`), the expertises it loads by name
 * (`usedExpertise`) and the filters it loads expertises through
 * (`expertiseFilters`). The manifests are in memory, so the answer costs no
 * more than a loop, and it follows a change of the declarations at once.
 */

const { Expertises } = require('../../common/models.common.js');
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
 * The features that use a skill or an expertise, from their declarations.
 *
 * @param {'skill'|'expertise'} kind
 * @param {Object} entity a skill (`skillId`) or an expertise (`expertiseId`,
 *   and its `category`, `scope`, `isTransversal`, `appliesToEmailTypes`)
 * @returns {Array<{ featureType: string, description: string }>}
 */
function featuresUsing(kind, entity) {
  if (!KINDS.includes(kind) || !entity) return [];
  return manifestRegistry
    .listManifests()
    .filter((manifest) => declaresUse(manifest, kind, entity))
    .map((manifest) => ({
      featureType: manifest.featureType,
      description: manifest.description || manifest.featureType,
    }));
}

/**
 * The features that use a skill or an expertise, by its identifier. An
 * expertise is read for the attributes its filters are matched against; one
 * that is not stored can still be named by a feature.
 */
async function usedByFeatures({ kind, id }) {
  if (kind !== 'expertise') return featuresUsing(kind, { skillId: id });
  const expertise = await Expertises.findOne(
    { expertiseId: id },
    {
      expertiseId: 1,
      category: 1,
      scope: 1,
      isTransversal: 1,
      appliesToEmailTypes: 1,
    }
  ).lean();
  return featuresUsing(kind, expertise || { expertiseId: id });
}

/**
 * A skill or an expertise as the back office reads it, with the features that
 * use it (`usedBy`). Takes a stored document or a plain record.
 */
function withUsedBy(kind, entity) {
  const record =
    entity && typeof entity.toJSON === 'function' ? entity.toJSON() : entity;
  return { ...record, usedBy: featuresUsing(kind, record) };
}

module.exports = {
  featuresUsing,
  usedByFeatures,
  withUsedBy,
};
