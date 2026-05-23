'use strict';

const { Expertises } = require('../../common/models.common.js');
const { SkillStatuses } = require('../constant/skill-constants.js');

/**
 * Find ACTIVE expertise modules matching the given filters, projecting only
 * the active version of each. Used by features composing skill inputs.
 *
 * @param {Object} filters
 * @param {string|string[]} [filters.scope]
 * @param {string} [filters.emailType]
 * @param {string} [filters.language]
 * @param {string} [filters.category]
 * @returns {Promise<Array<{expertiseId: string, title: string, body: string, examplesGood: string[], examplesBad: string[], versionNumber: number}>>}
 */
async function findApplicable({ scope, emailType, language, category } = {}) {
  const query = { status: SkillStatuses.ACTIVE };

  if (scope) {
    query.scope = Array.isArray(scope) ? { $in: scope } : scope;
  }
  if (emailType) {
    query.appliesToEmailTypes = emailType;
  }
  if (language) {
    // Empty appliesToLanguages array means "all languages".
    query.$or = [
      { appliesToLanguages: language },
      { appliesToLanguages: { $size: 0 } },
    ];
  }
  if (category) {
    query.category = category;
  }

  const docs = await Expertises.find(query).lean();

  return docs.map((doc) => projectActiveVersion(doc)).filter((d) => d !== null);
}

function projectActiveVersion(doc) {
  if (!doc.activeVersion) return null;
  const version = (doc.versions || []).find(
    (v) => v.versionNumber === doc.activeVersion
  );
  if (!version) return null;

  return {
    expertiseId: doc.expertiseId,
    title: doc.title,
    category: doc.category,
    scope: doc.scope,
    versionNumber: version.versionNumber,
    body: version.body,
    examplesGood: version.examplesGood || [],
    examplesBad: version.examplesBad || [],
    sections: version.sections || [],
  };
}

module.exports = { findApplicable, projectActiveVersion };
