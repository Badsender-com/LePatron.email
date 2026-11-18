'use strict';

const {
  displayBlockingFindings,
  displayWaitingForChecks,
} = require('../badsender-control-quality');
const remoteApi = require('./quality-remote');

// The quality gate of the exports (the download with its FTP or CDN push,
// the ESP send; ADR 0009): the one place that decides whether an email may
// leave. A finding of a blocking check stops it and is listed in a modal; a
// failure of the checks never does. When a check the server runs is
// blocking, the export waits for the server, about 30 seconds at most, and
// can be cancelled meanwhile; past that, or when the server refuses or
// fails, the email leaves with a notice that its links and images were not
// checked. There is no way past a blocking finding.

// The server stops its own run at 20 s (quality-resources.service.js); the
// rest covers a turn behind another tab's run and the way there and back.
const SERVER_WAIT_MS = 30000;
const MS_PER_SECOND = 1000;

const UNCHECKED_KEYS = {
  'too-frequent':
    'Too many checks in a short time: the links and images were not checked. Check them yourself before the email leaves.',
  default:
    'The links and images could not be checked: check them yourself before the email leaves.',
};

const blockingOf = (findings) => findings.filter((finding) => finding.blocking);

const verdictOf = ({
  blocked = false,
  cancelled = false,
  busy = false,
  unchecked = null,
  findings = [],
  present = () => {},
} = {}) => ({
  // The only question the exports ask.
  leaves: !blocked && !cancelled && !busy,
  blocked,
  cancelled,
  busy,
  // Why the server's checks did not count: 'timeout' | 'too-frequent' |
  // 'failed', or null.
  unchecked,
  findings,
  present,
});

/**
 * The run of the checks for one export, with what the gate does with it.
 * @param {Object} quality - viewModel.quality
 * @param {Object} runs - what the review gives the gate (quality-review.js)
 * @param {Object} options - `html`, the HTML about to leave; `quiet`
 * @returns {Object} `local`: the run's local results; `remote`: the promise
 *   of its outcome once the server answered (remote-checks.js) when the
 *   export waits for it, null otherwise; `cancel()`: abandons the run;
 *   `giveUp()`: stops waiting for the server, its checks listed as
 *   cancelled; `present()`: shows the run's results in the drawer, without
 *   asking the server again; `isCurrent()`: whether the drawer shows them.
 */
function exportRun(quality, runs, options) {
  const cancel = remoteApi.createCancel();
  const run = runs.start({ ...options, cancel });
  let latest = { ...run.local, status: 'idle', failure: null };
  run.remote.then((outcome) => {
    latest = outcome;
  });
  const isCurrent = () => runs.isCurrent(run.id);
  return {
    local: run.local,
    remote: run.waits ? run.remote : null,
    isCurrent,
    cancel() {
      if (isCurrent()) quality.cancel();
      cancel.cancel();
    },
    giveUp: () => cancel.cancel(),
    present: () => runs.present(run, latest),
  };
}

/**
 * Adds `viewModel.quality.gate` and `viewModel.quality.gating`, after the
 * review (quality-review.js).
 * @param {Object} viewModel
 * @param {Object} ko - knockout
 * @param {Object} deps - `runs`, from the review; the rest injectable for
 *   tests
 */
function installQualityGate(viewModel, ko, deps) {
  const { runs } = deps;
  const defer = deps.defer || ((fn) => setTimeout(fn, 0));
  const serverWaitMs = deps.serverWaitMs || SERVER_WAIT_MS;
  const showBlocking = deps.displayBlockingFindings || displayBlockingFindings;
  const showWaiting = deps.displayWaitingForChecks || displayWaitingForChecks;
  const t = (key, params) => (viewModel.t ? viewModel.t(key, params) : key);
  const notify = (level, message) => {
    if (viewModel.notifier && viewModel.notifier[level]) {
      viewModel.notifier[level](message);
    }
  };
  const quality = viewModel.quality;
  // What is being checked for an export (the caller's `target`), or null.
  const gating = ko.observable(null);

  // The verdict is taken before anything shows: a modal that fails to show
  // never lets the email leave.
  function stop(run, blocking, quiet) {
    const verdict = verdictOf({ blocked: true, findings: blocking });
    try {
      // Before an ESP send the drawer opens only on what blocks.
      if (quiet && run.isCurrent()) quality.open('checks');
      showBlocking(blocking, viewModel, {
        onReveal: () => quality.reveal(blocking[0]),
      });
    } catch (err) {
      console.error('Showing the blocking findings failed', err);
    }
    return verdict;
  }

  // Resolves with the server's outcome, `{ failure: 'timeout' }` when the
  // wait runs out, or `{ cancelled: true }`.
  function waitForServer(run) {
    return new Promise((resolve) => {
      let waiting = null;
      let timer = null;
      const finish = (outcome) => {
        if (!timer) return;
        clearTimeout(timer);
        timer = null;
        if (waiting) waiting.close();
        resolve(outcome);
      };
      timer = setTimeout(() => {
        run.giveUp();
        finish({ failure: 'timeout' });
      }, serverWaitMs);
      try {
        waiting = showWaiting(viewModel, {
          seconds: Math.round(serverWaitMs / MS_PER_SECOND),
          onCancel: () => {
            run.cancel();
            finish({ cancelled: true });
          },
        });
      } catch (err) {
        // Still bounded by the timer.
        console.error('Showing the wait for the checks failed', err);
      }
      run.remote.then(finish, () => finish({ failure: 'failed' }));
    });
  }

  function decide({ html, quiet = false }) {
    let run;
    try {
      run = exportRun(quality, runs, { html, quiet });
    } catch (err) {
      console.error('Quality review failed', err);
      return Promise.resolve(verdictOf());
    }
    // A local finding already blocks: no need to wait for the server.
    const local = blockingOf(run.local.findings);
    if (local.length) return Promise.resolve(stop(run, local, quiet));
    if (!run.remote)
      return Promise.resolve(verdictOf({ present: run.present }));
    return waitForServer(run).then((outcome) => {
      if (outcome.cancelled) return verdictOf({ cancelled: true });
      const blocking = blockingOf(outcome.findings || []);
      if (blocking.length) return stop(run, blocking, quiet);
      if (outcome.failure) {
        notify(
          'warning',
          t(UNCHECKED_KEYS[outcome.failure] || UNCHECKED_KEYS.default)
        );
      }
      return verdictOf({ unchecked: outcome.failure, present: run.present });
    });
  }

  /**
   * Decides whether an export may leave. The checks run after the click, on
   * the HTML about to leave; one export is checked at a time.
   * @param {Object} options
   * @param {string} options.html - the HTML already exported
   * @param {boolean} [options.quiet] - the drawer opens only on what blocks
   *   (before an ESP send)
   * @param {*} [options.target] - what is exported, shown as being checked
   *   through `gating` (the ESP profile)
   * @returns {Promise<Object>} never rejects: `leaves`, and why not
   *   (`blocked` with its `findings`, `cancelled`, `busy`); `unchecked`;
   *   `present()` opens the drawer on this run's results
   */
  function gate(options = {}) {
    if (gating()) {
      notify(
        'info',
        t(
          'The quality checks of this email are still running: wait for them to finish'
        )
      );
      return Promise.resolve(verdictOf({ busy: true }));
    }
    gating(options.target || true);
    const done = (verdict) => {
      gating(null);
      return verdict;
    };
    // Deferred: the local checks are synchronous, and the button that was
    // clicked shows its state first.
    return new Promise((resolve, reject) =>
      defer(() => {
        try {
          resolve(decide(options));
        } catch (err) {
          reject(err);
        }
      })
    )
      .catch((err) => {
        console.error('Quality gate failed', err);
        return verdictOf();
      })
      .then(done);
  }

  quality.gate = gate;
  quality.gating = gating;
}

module.exports = { installQualityGate, SERVER_WAIT_MS };
