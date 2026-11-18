'use strict';

const { REMOTE_RULES } = require('./engine');
const { hasResources } = require('./resources');
const remoteApi = require('./quality-remote');

// The server's part of a quality review (links, image weight, blocklists):
// it comes after the local checks, on the export they just read, and its
// results join theirs in the drawer unless a newer run started. The server
// runs one check at a time per user: a request waits for the previous one,
// and is not sent at all if a newer run replaced it.

// The server's checks that are always listed; a blocklist is only where the
// platform subscribed to one.
const listedRemoteRules = REMOTE_RULES.filter((rule) => !rule.optional);

const remoteCheck = (status) => (rule) => ({
  ruleId: rule.id,
  category: rule.category,
  titleKey: rule.titleKey,
  status,
});

/**
 * @param {Object} options
 * @param {Object} options.state - the review's observables: `findings`,
 *   `checks`, `remoteStatus`, `remoteError`
 * @param {Function} options.isCurrent - `(id)`: whether run `id` still owns
 *   the drawer
 * @param {Function} options.surface - `(id)`: opens the drawer on run `id`
 * @param {Function} options.isOn - `(rule)`: whether a check is on
 * @param {string} [options.url] - where to ask; nothing is asked without one
 * @param {Function} options.checkResources - quality-remote's postResources
 * @param {Function} options.runRules - the engine's `runRules(ctx, rules)`
 * @param {Function} options.run - `(options)`: the engine's whole run, for an
 *   engine that hands no context back
 */
function createRemoteChecks(options) {
  const { state, isCurrent, surface, isOn, url } = options;
  const { checkResources, runRules, run: runEngine } = options;
  const listed = listedRemoteRules.filter(isOn);
  // Nothing to ask the server when every check it serves is off.
  const anyOn = REMOTE_RULES.some(isOn);
  let inFlight = Promise.resolve();
  let pending = null;
  // The local results the server's checks complete.
  let lastLocal = null;

  // The server's rules read its answer on the context of the local pass
  // (parsed once).
  function evaluate(local, answer) {
    if (local.ctx && typeof runRules === 'function') {
      local.ctx.remote = answer;
      return runRules(local.ctx, REMOTE_RULES);
    }
    // An engine that hands no context back: the export is read again.
    return runEngine({ html: local.html, rules: REMOTE_RULES, remote: answer });
  }

  // The answer to the previous run would be dropped: aborted rather than
  // waited for, it frees the server's turn for the next one.
  const abortPending = () => pending && pending.cancel();

  function ask(id, local, cancel, answer) {
    const request = inFlight
      .catch(() => {})
      .then(() =>
        isCurrent(id) || answer
          ? checkResources(url, local.resources, { cancelToken: cancel.token })
          : null
      );
    inFlight = request;
    return request;
  }

  /**
   * Asks the server about the export the local checks just read.
   * @param {number} id - the run
   * @param {Object} local - its local results
   * @param {Object} [runOptions] - `silent`: never opens the drawer;
   *   `answer`: asked even when a later run replaced this one, for a gate
   *   that waits on it, and aborted only through its own `cancel`
   * @returns {Promise<Object>} what the run ends up with: `findings` and
   *   `checks`, the local ones and the server's; `status`: 'idle' (not
   *   asked) | 'done' | 'error'; `failure`: 'too-frequent' | 'failed' | null
   */
  function run(id, local, runOptions = {}) {
    const { silent = false, answer = false } = runOptions;
    const cancel = runOptions.cancel || remoteApi.createCancel();
    abortPending();
    const asLocal = { ...local, status: 'idle', failure: null };
    if (!url || !anyOn || !hasResources(local.resources)) {
      if (isCurrent(id)) state.remoteStatus('idle');
      return Promise.resolve(asLocal);
    }
    lastLocal = local;
    state.remoteStatus('running');
    state.remoteError(null);
    pending = answer ? null : cancel;
    return ask(id, local, cancel, answer)
      .then((remote) => {
        if (remote === null) return asLocal;
        const result = evaluate(local, remote);
        const outcome = {
          findings: local.findings.concat(result.findings),
          checks: local.checks.concat(result.checks),
          status: 'done',
          failure: null,
        };
        if (!isCurrent(id)) return outcome;
        state.findings(outcome.findings);
        state.checks(outcome.checks);
        state.remoteStatus('done');
        if (!silent) surface(id);
        return outcome;
      })
      .catch((err) => {
        // Aborted (an export that stopped waiting): not run, not failed.
        if (remoteApi.isCancel(err)) {
          const cancelled = {
            ...asLocal,
            checks: local.checks.concat(listed.map(remoteCheck('cancelled'))),
          };
          if (isCurrent(id)) {
            state.checks(cancelled.checks);
            state.remoteStatus('idle');
          }
          return cancelled;
        }
        // Listed as checks that could not run, never as passed. A blocklist
        // may not even be configured: it is left out.
        const outcome = {
          findings: local.findings,
          checks: local.checks.concat(listed.map(remoteCheck('error'))),
          status: 'error',
          failure: remoteApi.isTooFrequent(err) ? 'too-frequent' : 'failed',
        };
        if (!isCurrent(id)) return outcome;
        console.error('Quality checks on the server failed', err);
        state.checks(outcome.checks);
        state.remoteError(outcome.failure);
        state.remoteStatus('error');
        return outcome;
      });
  }

  /** Stops the server's part of the run: its checks are listed as cancelled. */
  function cancel() {
    abortPending();
    if (state.remoteStatus() !== 'running') return;
    // Not run, and said so: they never count as passed.
    if (lastLocal) {
      state.checks(
        lastLocal.checks.concat(listed.map(remoteCheck('cancelled')))
      );
    }
    state.remoteStatus('idle');
  }

  return { run, cancel, abortPending, listedCount: listed.length };
}

module.exports = { createRemoteChecks, listedRemoteRules };
