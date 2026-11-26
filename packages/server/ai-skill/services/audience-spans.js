'use strict';

/**
 * When a skill or an expertise was open to every company (ADR 0031), from
 * its audience history: each change of audience, and each archiving and
 * republication. An item is open to every company while its audience is
 * `all` and it is not archived. A company other than the platform company
 * sees an item only then, and dates the first version it sees by the
 * opening: every tool that dates a version for it reads it here.
 *
 * Pure: it reads the item as stored, its `audience`, its `status` and its
 * `audienceHistory`.
 */

const { Audiences, SkillStatuses } = require('../constant/skill-constants.js');

const time = (date) => new Date(date).getTime();

// An archiving or a republication: an entry that says whether the item is
// archived from then on. Any other entry is a change of audience.
const isArchiving = (entry) => typeof entry.archived === 'boolean';

const otherAudience = (audience) =>
  audience === Audiences.ALL ? Audiences.PLATFORM : Audiences.ALL;

/**
 * Where the item stood before its first recorded change: on each side, the
 * other way from the first change recorded there; with none recorded on a
 * side, where it stands now.
 */
function stateBefore(item, history) {
  const firstAudience = history.find((entry) => !isArchiving(entry));
  const firstArchiving = history.find(isArchiving);
  return {
    audience: firstAudience
      ? otherAudience(firstAudience.audience)
      : item.audience,
    archived: firstArchiving
      ? !firstArchiving.archived
      : item.status === SkillStatuses.ARCHIVED,
  };
}

/**
 * The changes of an item's history that change where it stands, the first
 * first: an entry that leaves it as it was (written twice, or by a follow)
 * is no change.
 *
 * @param {Object} item the stored skill or expertise
 * @returns {{ initial: Object, steps: Array<{ at: number, archiving:
 *   boolean, before: Object, after: Object }> }} each state is
 *   `{ audience, archived }`
 */
function audienceSteps(item) {
  const history = [...(item.audienceHistory || [])].sort(
    (a, b) => time(a.at) - time(b.at)
  );
  const initial = stateBefore(item, history);
  const steps = [];
  let state = initial;
  history.forEach((entry) => {
    const archiving = isArchiving(entry);
    const after = archiving
      ? { ...state, archived: entry.archived }
      : { ...state, audience: entry.audience };
    if (after.audience === state.audience && after.archived === state.archived)
      return;
    steps.push({ at: time(entry.at), archiving, before: state, after });
    state = after;
  });
  return { initial, steps };
}

const isOpen = ({ audience, archived }) =>
  audience === Audiences.ALL && !archived;

/**
 * When an item was open to every company: spans from an opening to a
 * withdrawal, `-Infinity` when it was open before anything recorded (an
 * item open to every company with no history is open since its first
 * publication), and `Infinity` while it still is.
 *
 * @param {Object} item
 * @returns {Array<{ from: number, to: number }>}
 */
function openSpans(item) {
  const { initial, steps } = audienceSteps(item);
  const spans = [];
  let from = isOpen(initial) ? -Infinity : null;
  steps.forEach(({ at, after }) => {
    if (isOpen(after) && from === null) from = at;
    if (!isOpen(after) && from !== null) {
      spans.push({ from, to: at });
      from = null;
    }
  });
  if (from !== null) spans.push({ from, to: Infinity });
  return spans.filter((span) => span.from < span.to);
}

/**
 * When the item was last opened to every company, if it still is and the
 * opening is recorded; null otherwise.
 *
 * @param {Object} item
 * @returns {number|null} in milliseconds
 */
function openedSince(item) {
  const [last] = openSpans(item).slice(-1);
  return last && last.to === Infinity && last.from > -Infinity
    ? last.from
    : null;
}

/**
 * The date a reader gives a version it is served now: its own for the
 * platform company; for another company, the opening when the version was
 * published before it, since that company saw nothing before.
 *
 * @param {Object} item the stored item, with its audience history
 * @param {Date|string|null} date when the version was published, or last
 *   changed
 * @param {boolean} everyAudience whether the reader sees every audience
 * @returns {Date|string|null}
 */
function datedFor(item, date, everyAudience) {
  if (!date || everyAudience) return date;
  const since = openedSince(item);
  return since !== null && since > time(date) ? new Date(since) : date;
}

module.exports = {
  audienceSteps,
  openSpans,
  openedSince,
  datedFor,
  isArchiving,
};
