// The publication guard in the back office (ADR 0019): publishing a version a
// feature uses first replays the test cases of the feature skills concerned,
// before and after. The rules the guard dialog reads live here, so they are
// tested on their own: the project mounts no component in its tests.

export const GUARD_REQUIRED = 'SKILL_PUBLICATION_GUARD_REQUIRED';

// The server asked for the guard: what it would replay, or null for any
// other error.
export function guardRequired(err) {
  const response = err && err.response;
  if (!response || response.status !== 409) return null;
  const data = response.data || {};
  if (data.message !== GUARD_REQUIRED) return null;
  return {
    usedBy: Array.isArray(data.usedBy) ? data.usedBy : [],
    calls: Number(data.calls) || 0,
    maxCalls: Number(data.maxCalls) || 0,
    notReplayed: Number(data.notReplayed) || 0,
    missing: Array.isArray(data.missing) ? data.missing : [],
  };
}

// How often the page reads a running guard again: it runs on the server, a
// few AI calls at a time, for a minute or more.
export const GUARD_POLL_MS = 3000;

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Reads a run of the guard again until it is no longer running.
 *
 * @param {{ id: string, status: string }} run as its start answered it
 * @param {(id: string) => Promise<Object>} read reads the run again
 * @param {{ wait?: Function, stopped?: () => boolean }} [options]
 *   `stopped`: whether the page let it go (its dialog closed)
 * @returns {Promise<Object|null>} the run, done or failed; null once stopped
 */
export async function followGuard(
  run,
  read,
  { wait = delay, stopped = () => false } = {}
) {
  let current = run;
  while (current && current.status === 'running') {
    // eslint-disable-next-line no-await-in-loop
    await wait(GUARD_POLL_MS);
    if (stopped()) return null;
    // eslint-disable-next-line no-await-in-loop
    current = await read(current.id);
  }
  return current;
}

// Why a run of the guard failed, as the server's error is read.
export function guardFailure(run) {
  return run && run.status === 'failed'
    ? { response: { data: { message: run.code } } }
    : null;
}

// The test cases the replay leaves out past its cap of AI calls.
export function notReplayedOf(guardOrPlan) {
  return Number((guardOrPlan || {}).notReplayed) || 0;
}

/**
 * How one side of a replayed case went.
 *
 * @param {{ output }|{ error }|null} result
 * @param {boolean|null} contract whether the output follows the skill's
 *   output contract
 * @returns {'none'|'ok'|'contract'|'error'} `none`: nothing to replay on
 *   that side (a skill published for the first time has no before)
 */
export function sideOutcome(result, contract) {
  if (!result) return 'none';
  if (result.error === 'OUTPUT_CONTRACT' || contract === false) {
    return 'contract';
  }
  if (result.error) return 'error';
  return 'ok';
}

export function caseOutcome(testCase) {
  const contract = (testCase && testCase.contract) || {};
  return sideOutcome(testCase && testCase.after, contract.after);
}

// The cases whose new output is missing or breaks the contract.
export function failedCount(guard) {
  const cases = (guard && guard.cases) || [];
  return cases.filter((c) => caseOutcome(c) !== 'ok').length;
}

// An output as the person reads it: the text alone when that is all there
// is, the JSON otherwise.
export function outputText(result) {
  if (!result || result.error || result.output === undefined) return '';
  const { output } = result;
  if (
    output &&
    typeof output.text === 'string' &&
    Object.keys(output).length === 1
  ) {
    return output.text;
  }
  return JSON.stringify(output, null, 2);
}

// What a good output should hold, as the test case says it: its text, or its
// JSON; empty when the case says nothing of it.
export function expectedText(testCase) {
  const expected = testCase && testCase.expectedOutput;
  if (expected === undefined || expected === null || expected === '') return '';
  return typeof expected === 'string'
    ? expected
    : JSON.stringify(expected, null, 2);
}
