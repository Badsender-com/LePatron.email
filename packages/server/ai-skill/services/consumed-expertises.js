'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillIdRegex,
  MaxSkillIdLength,
  MaxConsumedExpertises,
  SkillNatures,
  SkillStatuses,
  Audiences,
} = require('../constant/skill-constants.js');
const { published } = require('../repositories/published.repository.js');
const { isAvailableTo } = require('./audience.js');

// Warning identifiers sent to the UI with a publication, which holds the
// fr/en wording under `aiSkills.warnings.*`, as for the template's.
const ConsumedWarningCodes = Object.freeze({
  NOT_PUBLISHED: 'CONSUMED_EXPERTISES_NOT_PUBLISHED',
  PLATFORM_ONLY: 'CONSUMED_EXPERTISES_PLATFORM_ONLY',
});

// What a warning reads of a consumed expertise: its title, whether it is
// published, and its audience; of its versions, the active one alone.
const PUBLICATION_FIELDS = Object.freeze({
  expertiseId: 1,
  title: 1,
  status: 1,
  audience: 1,
  activeVersion: 1,
  versions: { $elemMatch: { status: SkillStatuses.ACTIVE } },
});

function isExpertiseId(id) {
  return (
    typeof id === 'string' &&
    id.length <= MaxSkillIdLength &&
    SkillIdRegex.test(id)
  );
}

/**
 * The expertises a skill's version consumes (ADR 0013), checked when a draft
 * is saved and when it is published: a list of at most MaxConsumedExpertises
 * expertise ids, each named once and naming an expertise that exists,
 * whatever its status.
 * An expertise is archived, never deleted, so one that exists at save still
 * does at publication; the MCP adapter skips the ones not published.
 *
 * The count comes first, so a long list is refused before anything reads
 * its entries.
 *
 * @param {*} ids the version's `consumedExpertiseIds`, as the request sent it
 * @returns {Promise<void>}
 * @throws {HttpError} 400 SKILL_CONSUMED_EXPERTISES_INVALID,
 *   SKILL_CONSUMED_EXPERTISES_TOO_MANY (with `max`),
 *   SKILL_CONSUMED_EXPERTISES_DUPLICATED (with the `expertiseIds` named
 *   more than once) or
 *   SKILL_CONSUMED_EXPERTISES_NOT_FOUND (with the `expertiseIds` missing)
 */
async function assertConsumedExpertises(ids) {
  if (!Array.isArray(ids)) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_INVALID);
  }
  if (ids.length > MaxConsumedExpertises) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_TOO_MANY, {
      max: MaxConsumedExpertises,
    });
  }
  if (!ids.every(isExpertiseId)) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_INVALID);
  }
  if (!ids.length) return;
  const duplicated = [
    ...new Set(ids.filter((id, index) => ids.indexOf(id) !== index)),
  ];
  if (duplicated.length) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_DUPLICATED, {
      expertiseIds: duplicated,
    });
  }

  const found = await Expertises.find(
    { expertiseId: { $in: ids } },
    { expertiseId: 1 }
  ).lean();
  const known = new Set(found.map((e) => e.expertiseId));
  const missing = ids.filter((id) => !known.has(id));
  if (missing.length) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_NOT_FOUND, {
      expertiseIds: missing,
    });
  }
}

// The ids a version consumes, each once: a feature skill's version
// consumes none.
const consumedIdsOf = (version) =>
  version && version.nature === SkillNatures.TASK
    ? [...new Set(version.consumedExpertiseIds || [])]
    : [];

// The consumed expertises that are published, by id.
async function publishedConsumed(ids) {
  const docs = await Expertises.find(
    { expertiseId: { $in: ids } },
    PUBLICATION_FIELDS
  ).lean();
  return new Map(
    docs.filter((doc) => published(doc)).map((doc) => [doc.expertiseId, doc])
  );
}

// A client company's view: the published ones not opened to all.
const keptToPlatform = (ids, publishedById) =>
  ids.filter(
    (id) => publishedById.has(id) && !isAvailableTo(publishedById.get(id))
  );

/**
 * The expertises a version consumes that are published but kept to the
 * platform company (ADR 0013): those the assistants of the other companies
 * would follow the skill without, once it is open to them. In the order the
 * version consumes them.
 *
 * @param {Object} [version] a skill's version
 * @returns {Promise<Array<{expertiseId: string, title: string}>>}
 */
async function platformOnlyExpertises(version) {
  const ids = consumedIdsOf(version);
  if (!ids.length) return [];
  const publishedById = await publishedConsumed(ids);
  return keptToPlatform(ids, publishedById).map((id) => ({
    expertiseId: id,
    title: publishedById.get(id).title,
  }));
}

/**
 * What a publication warns of, without refusing it (ADR 0013): a consumed
 * expertise that is not published is not served to the assistant, nor one
 * kept to the platform company to the assistants of the other companies,
 * when the skill is open to them. A feature skill's version consumes none.
 *
 * @param {Object} skill the skill, with its audience
 * @param {Object} [version] the version published
 * @returns {Promise<Array<{code: string, expertiseIds: string[]}>>}
 */
async function consumedExpertiseWarnings(skill, version) {
  const ids = consumedIdsOf(version);
  if (!ids.length) return [];

  const publishedById = await publishedConsumed(ids);
  const warnings = [];
  const notPublished = ids.filter((id) => !publishedById.has(id));
  if (notPublished.length) {
    warnings.push({
      code: ConsumedWarningCodes.NOT_PUBLISHED,
      expertiseIds: notPublished,
    });
  }
  const platformOnly =
    skill.audience === Audiences.ALL ? keptToPlatform(ids, publishedById) : [];
  if (platformOnly.length) {
    warnings.push({
      code: ConsumedWarningCodes.PLATFORM_ONLY,
      expertiseIds: platformOnly,
    });
  }
  return warnings;
}

module.exports = {
  assertConsumedExpertises,
  consumedExpertiseWarnings,
  consumedIdsOf,
  platformOnlyExpertises,
  ConsumedWarningCodes,
};
