// A copy (staging, development) follows production's skills and expertises
// (ADR 0019). What its pages read of it, as rules tested on their own.

/**
 * What this instance is, from `GET /ai-skills/follow`: a copy or not, whether
 * the nightly follow runs here, and the follow running now, if one is.
 *
 * @param {Object} [answer] the server's answer; none, the instance is taken
 *   for production, which shows no copy's controls
 * @returns {{ isCopy: boolean, nightly: boolean, lock: Object|null }}
 */
export function copyStateOf(answer) {
  if (!answer) return { isCopy: false, nightly: false, lock: null };
  const isCopy =
    typeof answer.isCopy === 'boolean' ? answer.isCopy : !!answer.configured;
  return {
    isCopy,
    nightly: !!(answer.nightly && answer.nightly.enabled),
    lock: answer.lock || null,
  };
}

/**
 * What this instance is, read from the server; production when it cannot be
 * read, so a page never offers a copy's actions it is not sure of.
 *
 * @param {Object} $axios
 * @param {Function} followRoute the route of the follow
 * @returns {Promise<Object>} as `copyStateOf` answers it
 */
export async function fetchCopyState($axios, followRoute) {
  try {
    return copyStateOf(await $axios.$get(followRoute()));
  } catch (error) {
    return copyStateOf(null);
  }
}

// Where an item of a copy comes from.
export const COPY_ORIGINS = Object.freeze({
  // Production's, and the follow keeps it equal to production.
  FOLLOWED: 'followed',
  // Production's, kept on the copy: the follow no longer touches it.
  KEPT: 'kept',
  // Written on the copy: the follow never touches it.
  LOCAL: 'local',
  // The copy's work, set aside by a follow or duplicated, from another item.
  COPIED: 'copied',
});

/**
 * @param {Object} item a skill or an expertise, as the server answers it
 * @param {boolean} isCopy whether this instance is a copy
 * @returns {string|null} one of `COPY_ORIGINS`, or null on production
 */
export function copyOriginOf(item, isCopy) {
  if (!isCopy || !item) return null;
  if (item.copiedFrom) return COPY_ORIGINS.COPIED;
  if (item.keptOnCopy) return COPY_ORIGINS.KEPT;
  if (item.followedAt) return COPY_ORIGINS.FOLLOWED;
  return COPY_ORIGINS.LOCAL;
}

/**
 * What a copy offers to do with an item that came from production: keep it
 * on the copy, follow production again, or duplicate one of its versions to
 * try something without touching the follow. Nothing on production, nothing
 * on an item written on the copy.
 *
 * @returns {{ keep: boolean, follow: boolean, duplicate: boolean }}
 */
export function copyActionsOf(item, isCopy) {
  const origin = copyOriginOf(item, isCopy);
  const fromProduction =
    origin === COPY_ORIGINS.FOLLOWED || origin === COPY_ORIGINS.KEPT;
  return {
    keep: origin === COPY_ORIGINS.FOLLOWED,
    follow: origin === COPY_ORIGINS.KEPT,
    duplicate: fromProduction && ((item && item.versions) || []).length > 0,
  };
}

const labelOf = ({ versionMajor, versionMinor }) =>
  `${versionMajor}.${versionMinor || 0}`;

/**
 * The versions an item can be duplicated from, newest first, and the one
 * chosen at first: the active version, or else the newest.
 *
 * @returns {{ choices: { value: string, text: string }[], initial: string|null }}
 */
export function duplicateChoicesOf(item) {
  const versions = [...((item && item.versions) || [])].sort(
    (a, b) =>
      b.versionMajor - a.versionMajor ||
      (b.versionMinor || 0) - (a.versionMinor || 0)
  );
  const choices = versions.map((version) => ({
    value: labelOf(version),
    text: `v${labelOf(version)}`,
    status: version.status,
  }));
  const active = item && item.activeVersion;
  const activeLabel =
    active && active.major != null
      ? `${active.major}.${active.minor || 0}`
      : null;
  const initial = choices.some(({ value }) => value === activeLabel)
    ? activeLabel
    : (choices[0] && choices[0].value) || null;
  return { choices, initial };
}

// The id of an item as the server answers it.
export function itemIdOf(kind, item) {
  return item && (kind === 'skill' ? item.skillId : item.expertiseId);
}
