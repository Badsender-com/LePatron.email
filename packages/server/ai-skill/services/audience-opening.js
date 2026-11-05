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
  MaxConsumedExpertises,
} = require('../constant/skill-constants.js');
const { published } = require('../repositories/published.repository.js');
const {
  isExpertiseId,
  platformOnlyExpertises,
} = require('./consumed-expertises.js');

const refused = (expertiseIds = []) =>
  createError(400, ERROR_CODES.SKILL_OPEN_EXPERTISES_INVALID, {
    expertiseIds,
  });

/**
 * The expertises to open with a skill, checked before anything is written:
 * only in the request that opens the skill to every company, and only those
 * the confirmation offers, the published expertises the version consumes
 * that are kept to the platform company. A list no longer than a version
 * consumes, of expertise ids, before any is compared.
 *
 * @param {Object} [version] the version the skill serves, or publishes
 * @param {*} ids the `openExpertiseIds` of the request
 * @param {boolean} opening whether the same request opens the skill to every
 *   company
 * @returns {Promise<string[]>} the ids to open, each once
 * @throws {HttpError} 400 SKILL_OPEN_EXPERTISES_INVALID, with the
 *   `expertiseIds` not offered when the list itself is valid
 */
async function assertOpenable(version, ids, opening) {
  if (ids === undefined) return [];
  if (
    !opening ||
    !Array.isArray(ids) ||
    ids.length > MaxConsumedExpertises ||
    !ids.every(isExpertiseId)
  ) {
    throw refused();
  }
  if (!ids.length) return [];
  const offered = new Set(
    (await platformOnlyExpertises(version)).map((e) => e.expertiseId)
  );
  const foreign = [...new Set(ids.filter((id) => !offered.has(id)))];
  if (foreign.length) throw refused(foreign);
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
