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
