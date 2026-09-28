'use strict';

const { runQualityChecks, DEFAULT_RULES } = require('./engine');

// The state of the last quality review, shared by the drawer, the toolbar
// button and the commands that export the email (download, ESP send).
//   status: 'idle' (never run) | 'running' | 'done'

/**
 * Adds `viewModel.showQuality` and `viewModel.quality` to the editor.
 * @param {Object} viewModel
 * @param {Object} ko - knockout
 * @param {Object} [deps] - injectable for tests
 */
function installQualityReview(viewModel, ko, deps = {}) {
  const run = deps.run || runQualityChecks;
  // Lets the drawer paint its "running" state before a synchronous run.
  const defer = deps.defer || ((fn) => setTimeout(fn, 0));

  const status = ko.observable('idle');
  const findings = ko.observableArray([]);
  const checks = ko.observableArray([]);
  const ranAt = ko.observable(null);
  // Bumped by every run and cancel: a result that comes back late is dropped.
  let runId = 0;

  function apply(result) {
    findings(result.findings);
    checks(result.checks);
    ranAt(new Date());
    status('done');
    return result;
  }

  function settle() {
    status(ranAt() ? 'done' : 'idle');
  }

  viewModel.showQuality = ko.observable(false);
  // The drawer's tab: the checks, or sending a test.
  const tab = ko.observable('checks');

  viewModel.quality = {
    status,
    findings,
    checks,
    ranAt,
    tab,
    ruleCount: DEFAULT_RULES.length,
    errorCount: ko.pureComputed(
      () => findings().filter((f) => f.severity === 'error').length
    ),

    /** Opens the drawer on a tab: 'checks' or 'send'. */
    open(name = 'checks') {
      tab(name);
      viewModel.showQuality(true);
    },
    // What the toolbar badge counts: what should be fixed, not the infos.
    issueCount: ko.pureComputed(
      () =>
        findings().filter((f) => f.severity === 'error' || f.severity === 'warning')
          .length
    ),
    passedCount: ko.pureComputed(
      () => checks().filter((c) => c.status === 'passed').length
    ),

    run() {
      const id = ++runId;
      status('running');
      defer(() => {
        if (id !== runId) return;
        try {
          apply(run(viewModel));
        } catch (err) {
          console.error('Quality review failed', err);
          settle();
        }
      });
    },

    cancel() {
      runId++;
      settle();
    },

    /**
     * Reviews the HTML an export is about to send, and opens the drawer when
     * there is something to see. Never blocks the export: a failure is logged.
     * @param {Object} [options] - `html`: the HTML already exported
     */
    review(options) {
      runId++;
      try {
        const result = apply(run(viewModel, options));
        if (result.findings.length) viewModel.quality.open('checks');
        return result;
      } catch (err) {
        console.error('Quality review failed', err);
        settle();
        return null;
      }
    },
  };
}

module.exports = { installQualityReview };
