// The expertises a task skill's version consumes (ADR 0013), as the version
// editor lists them: in the order the assistant reads them, each with its
// title, and what keeps it from an assistant: not found, not published, or
// kept to the platform company.

import {
  AUDIENCES,
  MAX_CONSUMED_EXPERTISES,
  STATUSES,
} from '../../shared/ai-skill/constants.js';

// A version consumes this many expertises at most, as the server checks.
export { MAX_CONSUMED_EXPERTISES };

// What keeps a consumed expertise from an assistant. A row has none when
// nothing does, or before the expertises are read.
export const CONSUMED_STATES = Object.freeze({
  NOT_FOUND: 'notFound',
  NOT_PUBLISHED: 'notPublished',
  PLATFORM_ONLY: 'platformOnly',
});

// Published: an active expertise with an active version, as the server
// serves it.
const isPublished = (expertise) =>
  expertise.status === STATUSES.ACTIVE &&
  !!expertise.activeVersion &&
  expertise.activeVersion.major != null;

function stateOf(expertise, known) {
  if (!expertise) return known ? CONSUMED_STATES.NOT_FOUND : null;
  if (!isPublished(expertise)) return CONSUMED_STATES.NOT_PUBLISHED;
  return expertise.audience === AUDIENCES.ALL
    ? null
    : CONSUMED_STATES.PLATFORM_ONLY;
}

/**
 * The rows of the list, one per consumed id, in order.
 *
 * @param {string[]} ids the version's consumedExpertiseIds
 * @param {Object[]} expertises the expertises the editor could read, with
 *   their status, active version and audience
 * @param {boolean} known whether `expertises` was read: before it is, or when
 *   reading it failed, no id is said to be not found
 * @returns {{id: string, title: string|null, state: string|null}[]}
 */
export function consumedRows(ids, expertises, known) {
  const byId = new Map(expertises.map((e) => [e.expertiseId, e]));
  return (ids || []).map((id) => {
    const expertise = byId.get(id);
    return {
      id,
      title: expertise ? expertise.title : null,
      state: stateOf(expertise, known),
    };
  });
}

/**
 * The expertises one may still add: those published, minus the ones
 * consumed.
 *
 * @param {Object[]} expertises
 * @param {string[]} ids
 * @returns {{value: string, text: string}[]}
 */
export function addableExpertises(expertises, ids) {
  const consumed = new Set(ids || []);
  return expertises
    .filter((e) => isPublished(e) && !consumed.has(e.expertiseId))
    .map((e) => ({
      value: e.expertiseId,
      text: `${e.title} (${e.expertiseId})`,
    }));
}

/**
 * The list with one more expertise at its end, or the same list when it is
 * already there, or full: the server refuses an expertise consumed twice.
 *
 * @param {string[]} ids
 * @param {string} expertiseId
 * @returns {string[]}
 */
export function withConsumed(ids, expertiseId) {
  const list = ids || [];
  if (
    !expertiseId ||
    list.includes(expertiseId) ||
    list.length >= MAX_CONSUMED_EXPERTISES
  ) {
    return [...list];
  }
  return [...list, expertiseId];
}

/**
 * A copy of `ids` with the entry at `index` moved by `offset` places, or the
 * same order when it would leave the list.
 *
 * @param {string[]} ids
 * @param {number} index
 * @param {number} offset -1 to move it up, 1 to move it down
 * @returns {string[]}
 */
export function moveConsumed(ids, index, offset) {
  const next = [...ids];
  const target = index + offset;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
