// A change of audience the back office confirms first (ADR 0013): opening a
// task skill to every company, which may open the expertises it consumes
// kept to the platform company too, chosen one by one; and keeping an
// expertise to the platform company again, which the open task skills that
// consume it then go without.

import { AUDIENCES } from '../../shared/ai-skill/constants.js';

// An item stored before audiences has none, and is kept to the platform
// company until the migration opens it.
const audienceOf = (audience) => audience || AUDIENCES.PLATFORM;

/**
 * @param {string} [saved] the audience stored
 * @param {string} [chosen] the audience about to be saved
 * @returns {boolean} whether the item opens to every company
 */
export function opensToAll(saved, chosen) {
  return audienceOf(saved) !== AUDIENCES.ALL && chosen === AUDIENCES.ALL;
}

/**
 * @param {string} [saved] the audience stored
 * @param {string} [chosen] the audience about to be saved
 * @returns {boolean} whether the item, open to every company, is kept to the
 *   platform company again
 */
export function closesToPlatform(saved, chosen) {
  return saved === AUDIENCES.ALL && audienceOf(chosen) !== AUDIENCES.ALL;
}

/**
 * The selection with one expertise checked or unchecked, each once.
 *
 * @param {string[]} selected the expertise ids checked
 * @param {string} expertiseId
 * @param {boolean} checked
 * @returns {string[]}
 */
export function toggled(selected, expertiseId, checked) {
  const others = (selected || []).filter((id) => id !== expertiseId);
  return checked ? [...others, expertiseId] : others;
}

/**
 * What a publication sends of the audience: nothing unless the item opens
 * to every company, then the expertises chosen to open with it, among those
 * offered only.
 *
 * @param {boolean} openToAll
 * @param {string[]} selected the expertise ids checked
 * @param {Object[]} offered the expertises offered, `{ expertiseId }`
 * @returns {{openToAll?: boolean, openExpertiseIds?: string[]}}
 */
export function openingPayload(openToAll, selected, offered) {
  if (!openToAll) return {};
  const ids = new Set((offered || []).map((e) => e.expertiseId));
  const openExpertiseIds = (selected || []).filter((id) => ids.has(id));
  return {
    openToAll: true,
    ...(openExpertiseIds.length ? { openExpertiseIds } : {}),
  };
}
