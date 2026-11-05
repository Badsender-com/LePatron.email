// The expertises a task skill's version consumes (ADR 0013), as the version
// editor lists them: in the order the assistant reads them, each with its
// title, or flagged when the editor cannot find it.

import { MAX_CONSUMED_EXPERTISES } from '../../shared/ai-skill/constants.js';

// A version consumes this many expertises at most, as the server checks.
export { MAX_CONSUMED_EXPERTISES };

/**
 * The rows of the list, one per consumed id, in order.
 *
 * @param {string[]} ids the version's consumedExpertiseIds
 * @param {Object[]} expertises the expertises the editor could read
 * @param {boolean} known whether `expertises` was read: before it is, or when
 *   reading it failed, no id is said to be missing
 * @returns {{id: string, title: string|null, missing: boolean}[]}
 */
export function consumedRows(ids, expertises, known) {
  const titles = new Map(expertises.map((e) => [e.expertiseId, e.title]));
  return (ids || []).map((id) => ({
    id,
    title: titles.has(id) ? titles.get(id) : null,
    missing: known && !titles.has(id),
  }));
}

/**
 * The expertises one may still add: those read, minus the ones consumed.
 *
 * @param {Object[]} expertises
 * @param {string[]} ids
 * @returns {{value: string, text: string}[]}
 */
export function addableExpertises(expertises, ids) {
  const consumed = new Set(ids || []);
  return expertises
    .filter((e) => !consumed.has(e.expertiseId))
    .map((e) => ({
      value: e.expertiseId,
      text: `${e.title} (${e.expertiseId})`,
    }));
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
