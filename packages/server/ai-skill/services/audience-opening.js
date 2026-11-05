'use strict';

/**
 * The audience of a task skill and that of the expertises it consumes (ADR
 * 0013). A skill opened to every company is followed by their assistants
 * with the consumed expertises opened to them only: opening the skill may
 * open some of them too, chosen one by one, and closing an expertise again
 * leaves the open task skills that consume it without it.
 */

const createError = require('http-errors');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillNatures,
  SkillStatuses,
  Audiences,
} = require('../constant/skill-constants.js');
const { published } = require('../repositories/published.repository.js');
const { consumedIdsOf } = require('./consumed-expertises.js');

/**
 * The expertises to open with a skill, checked: only expertises the version
 * consumes, each named once.
 *
 * @param {Object} [version] the version the skill serves, or publishes
 * @param {*} ids the `openExpertiseIds` of the request
 * @returns {string[]} the ids to open
 * @throws {HttpError} 400 SKILL_OPEN_EXPERTISES_INVALID, with the
 *   `expertiseIds` the version does not consume
 */
function assertOpenable(version, ids) {
  if (ids === undefined) return [];
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === 'string')) {
    throw createError(400, ERROR_CODES.SKILL_OPEN_EXPERTISES_INVALID, {
      expertiseIds: [],
    });
  }
  const consumed = new Set(consumedIdsOf(version));
  const foreign = ids.filter((id) => !consumed.has(id));
  if (foreign.length) {
    throw createError(400, ERROR_CODES.SKILL_OPEN_EXPERTISES_INVALID, {
      expertiseIds: foreign,
    });
  }
  return [...new Set(ids)];
}

/**
 * Opens these expertises to every company: in the editor's features as
 * through an assistant, at once.
 *
 * @param {string[]} ids checked by assertOpenable
 * @returns {Promise<void>}
 */
async function openExpertises(ids) {
  if (!ids.length) return;
  await Expertises.updateMany(
    { expertiseId: { $in: ids } },
    { $set: { audience: Audiences.ALL } }
  );
}

/**
 * The task skills open to every company whose active version consumes this
 * expertise: those whose assistants no longer receive it once it is kept to
 * the platform company again.
 *
 * @param {string} expertiseId
 * @returns {Promise<Array<{skillId: string, title: string}>>}
 */
async function openTaskSkillsConsuming(expertiseId) {
  const skills = await LePatronSkills.find(
    {
      status: SkillStatuses.ACTIVE,
      audience: Audiences.ALL,
      'versions.consumedExpertiseIds': String(expertiseId),
    },
    {
      skillId: 1,
      title: 1,
      status: 1,
      activeVersion: 1,
      versions: { $elemMatch: { status: SkillStatuses.ACTIVE } },
    }
  ).lean();
  return skills
    .map((skill) => published(skill))
    .filter(
      (found) =>
        found &&
        found.version.nature === SkillNatures.TASK &&
        (found.version.consumedExpertiseIds || []).includes(expertiseId)
    )
    .map(({ doc }) => ({ skillId: doc.skillId, title: doc.title }));
}

module.exports = { assertOpenable, openExpertises, openTaskSkillsConsuming };
