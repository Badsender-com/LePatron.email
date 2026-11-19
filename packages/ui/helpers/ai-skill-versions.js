// The versions of a skill or an expertise, as the back office reads them.

import { STATUSES } from '../../shared/ai-skill/constants.js';

// Newest first: by major, then by minor.
const newestFirst = (a, b) =>
  b.versionMajor - a.versionMajor || b.versionMinor - a.versionMinor;

/**
 * The latest draft: the draft with the highest major, then minor. Versions
 * are stored in the order they were created, which is not that order: a
 * minor draft of an older major can come after a newer major.
 *
 * @param {Object[]} [versions]
 * @returns {Object|null}
 */
export function latestDraft(versions) {
  const [latest] = (versions || [])
    .filter((version) => version.status === STATUSES.DRAFT)
    .sort(newestFirst);
  return latest || null;
}
