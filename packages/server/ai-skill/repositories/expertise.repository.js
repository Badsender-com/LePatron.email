'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');

/**
 * Find ACTIVE expertise modules matching an invocation context, projecting
 * only the active version of each. Used by features composing skill inputs.
 *
 * ALL callers must pass both `scope` AND `categories` — a caller that wants a
 * broad mix enumerates explicitly. The verbosity is deliberate: the expertise
 * mix of a feature is a decision that must be visible in code review.
 *
 * Matching rules — an expertise matches when:
 *   - status ACTIVE
 *   - AND ( isTransversal === true  OR  intersection(expertise.scope, scope) ≠ ∅ )
 *   - AND expertise.category ∈ categories
 *   - AND ( appliesToEmailTypes empty  OR  emailType ∈ appliesToEmailTypes )
 *   - AND ( appliesToLanguages empty   OR  language ∈ appliesToLanguages )
 *
 * NB: an expertise with an empty scope that is NOT transversal NEVER matches
 * (inverted semantics). isTransversal short-circuits ONLY the scope clause —
 * never categories / emailType / language.
 *
 * @param {Object} filters
 * @param {string|string[]} filters.scope — REQUIRED
 * @param {string[]} filters.categories — REQUIRED, non-empty
 * @param {string} [filters.emailType]
 * @param {string} [filters.language]
 * @returns {Promise<Array<{expertiseId: string, title: string, body: string, examplesGood: string[], examplesBad: string[], versionMajor: number, versionMinor: number}>>}
 */
async function findApplicable({ scope, categories, emailType, language } = {}) {
  const scopes = Array.isArray(scope) ? scope : scope ? [scope] : [];
  if (!scopes.length || !Array.isArray(categories) || !categories.length) {
    throw createError(
      400,
      'findApplicable requiert un scope et au moins une catégorie — précisez le mix d\'expertise de votre feature'
    );
  }

  // Empty arrays on emailType/language documents still mean "applies to all".
  // For scope the semantics are INVERTED: empty scope no longer matches —
  // only a non-empty intersection or the isTransversal flag does.
  const and = [
    { status: SkillStatuses.ACTIVE },
    { $or: [{ isTransversal: true }, { scope: { $in: scopes } }] },
    { category: { $in: categories } },
  ];

  if (emailType) {
    and.push({
      $or: [
        { appliesToEmailTypes: emailType },
        { appliesToEmailTypes: { $size: 0 } },
      ],
    });
  }
  if (language) {
    and.push({
      $or: [
        { appliesToLanguages: language },
        { appliesToLanguages: { $size: 0 } },
      ],
    });
  }

  const docs = await Expertises.find({ $and: and }).lean();

  // Deterministic order = the order expertises appear in the composed prompt:
  // transversal (general) first, then alphabetical by expertiseId. Stable so
  // features and the playground filter mode get a predictable, reviewable mix.
  return docs
    .map((doc) => projectActiveVersion(doc))
    .filter((d) => d !== null)
    .sort((a, b) => {
      if (a.isTransversal !== b.isTransversal) return a.isTransversal ? -1 : 1;
      return a.expertiseId.localeCompare(b.expertiseId);
    });
}

function projectActiveVersion(doc) {
  const av = doc.activeVersion || {};
  if (av.major == null) return null;
  const version = (doc.versions || []).find(
    (v) => v.versionMajor === av.major && v.versionMinor === (av.minor || 0)
  );
  if (!version) return null;

  return {
    expertiseId: doc.expertiseId,
    title: doc.title,
    category: doc.category,
    scope: doc.scope,
    isTransversal: !!doc.isTransversal,
    versionMajor: version.versionMajor,
    versionMinor: version.versionMinor,
    body: version.body,
    examplesGood: version.examplesGood || [],
    examplesBad: version.examplesBad || [],
    sections: version.sections || [],
  };
}

module.exports = { findApplicable, projectActiveVersion };
