'use strict';

/**
 * The audience of a task skill and that of the expertises it consumes (ADR
 * 0013). A skill opened to every company is followed by their assistants
 * with the consumed expertises opened to them only: opening the skill may
 * open some of them too, chosen one by one, and closing an expertise again
 * leaves the open task skills that consume it without it.
 */

const createError = require('http-errors');
const logger = require('../../utils/logger.js');
const { Expertises, LePatronSkills } = require('../../common/models.common.js');
const ERROR_CODES = require('../../constant/error-codes.js');
const {
  SkillNatures,
  Audiences,
  MaxConsumedExpertises,
} = require('../constant/skill-constants.js');
const { findPublished } = require('../repositories/published.repository.js');
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

// The warning a skill saved answers when the expertises chosen to open with
// it could not be (`aiSkills.warnings.*` in the UI).
const OPEN_EXPERTISES_FAILED = 'OPEN_EXPERTISES_FAILED';

/**
 * Opens these expertises to every company, in the editor's features as
 * through an assistant, at once, once the skill is saved. The skill is: a
 * failure here is logged and told as a warning, never answered as an error.
 *
 * @param {string[]} ids checked by assertOpenable
 * @param {string} skillId the skill opened with them, for the log
 * @returns {Promise<Array<{code: string, expertiseIds: string[]}>>} the
 *   warning of the expertises not opened, if any
 */
async function openExpertises(ids, skillId) {
  if (!ids.length) return [];
  try {
    await Expertises.updateMany(
      { expertiseId: { $in: ids } },
      { $set: { audience: Audiences.ALL } }
    );
    return [];
  } catch (error) {
    logger.error(
      `[ai-skill] the expertises chosen to open with ${skillId} could not be opened: ${ids.join(
        ', '
      )}`,
      error
    );
    return [{ code: OPEN_EXPERTISES_FAILED, expertiseIds: ids }];
  }
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
  const id = String(expertiseId);
  const found = await findPublished(
    LePatronSkills,
    { audience: Audiences.ALL, 'versions.consumedExpertiseIds': id },
    { doc: ['skillId', 'title'], version: ['nature', 'consumedExpertiseIds'] }
  );
  return found
    .filter(
      ({ version }) =>
        version.nature === SkillNatures.TASK &&
        (version.consumedExpertiseIds || []).includes(id)
    )
    .map(({ doc }) => ({ skillId: doc.skillId, title: doc.title }));
}

module.exports = { assertOpenable, openExpertises, openTaskSkillsConsuming };
