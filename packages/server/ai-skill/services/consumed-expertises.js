'use strict';

const createError = require('http-errors');
const { Expertises } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillIdRegex,
  MaxSkillIdLength,
  MaxConsumedExpertises,
} = require('../constant/skill-constants.js');

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
 * expertise ids, each naming an expertise that exists, whatever its status.
 * An expertise is archived, never deleted, so one that exists at save still
 * does at publication; the MCP adapter skips the ones not published.
 *
 * The count comes first, so a long list is refused before anything reads
 * its entries.
 *
 * @param {*} ids the version's `consumedExpertiseIds`, as the request sent it
 * @returns {Promise<void>}
 * @throws {HttpError} 400 SKILL_CONSUMED_EXPERTISES_INVALID,
 *   SKILL_CONSUMED_EXPERTISES_TOO_MANY (with `max`) or
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

  const wanted = [...new Set(ids)];
  const found = await Expertises.find(
    { expertiseId: { $in: wanted } },
    { expertiseId: 1 }
  ).lean();
  const known = new Set(found.map((e) => e.expertiseId));
  const missing = wanted.filter((id) => !known.has(id));
  if (missing.length) {
    throw createError(400, ERROR_CODES.SKILL_CONSUMED_EXPERTISES_NOT_FOUND, {
      expertiseIds: missing,
    });
  }
}

module.exports = { assertConsumedExpertises };
