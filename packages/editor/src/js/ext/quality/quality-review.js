'use strict';

const axios = require('axios');
const { runQualityChecks, DEFAULT_RULES } = require('./engine');

// The state of the last quality review, shared by the drawer, the toolbar
// button and the commands that export the email (download, ESP send).
//   status: 'idle' (never run) | 'running' | 'done'
// Findings the team ignored are kept apart: they are stored on the email
// (PATCH /mailings/:id/quality-ignores) and shared by everyone who edits it.

// Stores one "ignore" change; resolves with the fingerprints the server keeps.
function patchIgnore(url, change) {
  return axios.patch(url, change).then((response) => response.data.qualityIgnores);
}

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
  const persist = deps.persist || patchIgnore;
  const metadata = viewModel.metadata || {};
  const ignoreUrl = metadata.url && metadata.url.qualityIgnores;

  const status = ko.observable('idle');
  const findings = ko.observableArray([]);
  const checks = ko.observableArray([]);
  const ranAt = ko.observable(null);
  const ignored = ko.observableArray((metadata.qualityIgnores || []).slice());
  // Bumped by every run and cancel: a result that comes back late is dropped.
  let runId = 0;

  const isIgnored = (finding) => ignored.indexOf(finding.fingerprint) !== -1;
  const active = ko.pureComputed(() => findings().filter((f) => !isIgnored(f)));
  const countOf = (...severities) =>
    ko.pureComputed(
      () => active().filter((f) => severities.includes(f.severity)).length
    );

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

  // Shown at once, stored in the background, put back as it was on failure.
  function setIgnored(finding, value) {
    const { fingerprint, ruleId } = finding;
    if (value === isIgnored(finding)) return Promise.resolve();
    if (value) ignored.push(fingerprint);
    else ignored.remove(fingerprint);
    if (!ignoreUrl) return Promise.resolve();
    return persist(ignoreUrl, { fingerprint, ruleId, ignored: value })
      .then((kept) => ignored(kept))
      .catch((err) => {
        console.error('Storing an ignored quality finding failed', err);
        if (value) ignored.remove(fingerprint);
        else ignored.push(fingerprint);
        if (viewModel.notifier) {
          viewModel.notifier.error(viewModel.t('The change could not be saved'));
        }
      });
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
    ignored,
    ruleCount: DEFAULT_RULES.length,
    // The findings still to deal with, and those the team chose to ignore.
    activeFindings: active,
    ignoredFindings: ko.pureComputed(() => findings().filter(isIgnored)),
    errorCount: countOf('error'),
    // What the toolbar badge counts: what should be fixed, not the infos.
    issueCount: countOf('error', 'warning'),
    passedCount: ko.pureComputed(
      () => checks().filter((c) => c.status === 'passed').length
    ),

    /** Opens the drawer on a tab: 'checks' or 'send'. */
    open(name = 'checks') {
      tab(name);
      viewModel.showQuality(true);
    },

    ignore: (finding) => setIgnored(finding, true),
    unignore: (finding) => setIgnored(finding, false),

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
        if (active().length) viewModel.quality.open('checks');
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
