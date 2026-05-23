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
 * @returns {Promise<Array<{expertiseId: string, title: string, body: string, examplesGood: string[], examplesBad: string[], versionMajor: number, versionMinor: number}>>}
 */
async function findApplicable({ scope, emailType, language, category } = {}) {
  // For each multi-valued filter, an empty array on the document means
  // "applies to all values" — i.e. the document is always a match for that
  // filter. We build $and / $or clauses so that the document matches when
  // EITHER it lists the requested value, OR its own list is empty.
  const and = [{ status: SkillStatuses.ACTIVE }];

  if (scope) {
    const scopes = Array.isArray(scope) ? scope : [scope];
    and.push({
      $or: [{ scope: { $in: scopes } }, { scope: { $size: 0 } }],
    });
  }
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
  if (category) {
    and.push({ category });
  }

  const query = and.length === 1 ? and[0] : { $and: and };
  const docs = await Expertises.find(query).lean();

  return docs.map((doc) => projectActiveVersion(doc)).filter((d) => d !== null);
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
    versionMajor: version.versionMajor,
    versionMinor: version.versionMinor,
    body: version.body,
    examplesGood: version.examplesGood || [],
    examplesBad: version.examplesBad || [],
    sections: version.sections || [],
  };
}

module.exports = { findApplicable, projectActiveVersion };
