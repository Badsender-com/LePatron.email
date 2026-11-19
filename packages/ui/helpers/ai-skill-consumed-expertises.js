// The expertises a task skill's version consumes (ADR 0013), as the version
// editor lists them: in the order the assistant reads them, each with its
// title, and what keeps it from an assistant: not found, not published, or
// kept to the platform company. The editor reads the consumed ones by id,
// and searches the published ones to add.

import {
  AUDIENCES,
  MAX_CONSUMED_EXPERTISES,
  EXPERTISE_SEARCH_MAX_LENGTH,
  STATUSES,
} from '../../shared/ai-skill/constants.js';

// A version consumes this many expertises at most, as the server checks.
export { MAX_CONSUMED_EXPERTISES };

// The expertises a search offers to add, at most.
export const SEARCH_RESULTS = 20;

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

function stateOf(expertise, read) {
  if (!expertise) return read ? CONSUMED_STATES.NOT_FOUND : null;
  if (!isPublished(expertise)) return CONSUMED_STATES.NOT_PUBLISHED;
  return expertise.audience === AUDIENCES.ALL
    ? null
    : CONSUMED_STATES.PLATFORM_ONLY;
}

/**
 * The rows of the list, one per consumed id, in order.
 *
 * @param {string[]} ids the version's consumedExpertiseIds
 * @param {Object[]} expertises the expertises the editor read, with their
 *   status, active version and audience
 * @param {string[]} readIds the ids the server was asked for: one of them
 *   it did not answer names no expertise; any other is not read yet, or
 *   reading it failed, and is not said to be not found
 * @returns {{id: string, title: string|null, state: string|null}[]}
 */
export function consumedRows(ids, expertises, readIds) {
  const byId = new Map(expertises.map((e) => [e.expertiseId, e]));
  const read = new Set(readIds || []);
  return (ids || []).map((id) => {
    const expertise = byId.get(id);
    return {
      id,
      title: expertise ? expertise.title : null,
      state: stateOf(expertise, read.has(id)),
    };
  });
}

/**
 * The consumed ids the server has not been asked for yet, as many as one
 * read takes.
 *
 * @param {string[]} ids the version's consumedExpertiseIds
 * @param {string[]} readIds the ids already asked for
 * @returns {string[]}
 */
export function idsToRead(ids, readIds) {
  const read = new Set(readIds || []);
  return [...new Set(ids || [])]
    .filter((id) => !read.has(id))
    .slice(0, MAX_CONSUMED_EXPERTISES);
}

/**
 * What the expertise list is asked for, to offer expertises to add: the
 * published ones that the text finds, a few of them.
 *
 * @param {string} [text] what is typed
 * @returns {{status: string, pageSize: number, search?: string}}
 */
export function searchParams(text) {
  const search = (text || '').trim().slice(0, EXPERTISE_SEARCH_MAX_LENGTH);
  return {
    status: STATUSES.ACTIVE,
    pageSize: SEARCH_RESULTS,
    ...(search ? { search } : {}),
  };
}

/**
 * The expertises known, with those just read, each once: a newer read of an
 * expertise replaces the older one.
 *
 * @param {Object[]} known
 * @param {Object[]} read
 * @returns {Object[]}
 */
export function withRead(known, read) {
  const byId = new Map(known.map((e) => [e.expertiseId, e]));
  read.forEach((e) => byId.set(e.expertiseId, e));
  return [...byId.values()];
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
