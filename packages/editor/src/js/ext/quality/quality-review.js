'use strict';

const engine = require('./engine');
const { hasResources } = require('./resources');
const { createIgnores } = require('./quality-ignores');
const remoteApi = require('./quality-remote');
const { watchContent } = require('./content-watch');

const { runQualityChecks, DEFAULT_RULES, REMOTE_RULES } = engine;

// The state of the last quality review, shared by the drawer, the toolbar
// button and the commands that export the email (download, ESP send).
//   status: 'idle' (never run) | 'running' | 'done' | 'stale' (the email
//     changed since the results were computed)
//   remoteStatus: the checks the server runs (links, image weight), which
//     come after the others: 'idle' | 'running' | 'done' | 'error'
//   remoteError: why the server's checks did not run: 'too-frequent' | 'failed'
// Findings the team ignored are kept apart (quality-ignores.js).

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
 * Adds `viewModel.showQuality` and `viewModel.quality` to the editor.
 * @param {Object} viewModel
 * @param {Object} ko - knockout
 * @param {Object} [deps] - injectable for tests
 */
function installQualityReview(viewModel, ko, deps = {}) {
  const run = deps.run || runQualityChecks;
  // The remote rules run on the context of the local pass (parsed once):
  // `runRules(ctx, rules)` of the engine.
  const runRules = deps.runRules || engine.runRules;
  // Lets the drawer paint its "running" state before a synchronous run.
  const defer = deps.defer || ((fn) => setTimeout(fn, 0));
  const checkResources = deps.checkResources || remoteApi.postResources;
  const watch = deps.watchContent || watchContent;
  const metadata = viewModel.metadata || {};
  const resourcesUrl = metadata.url && metadata.url.qualityResources;
  const t = (key, params) => (viewModel.t ? viewModel.t(key, params) : key);
  const notify = (level, message) => {
    if (viewModel.notifier && viewModel.notifier[level]) {
      viewModel.notifier[level](message);
    }
  };

  const status = ko.observable('idle');
  const findings = ko.observableArray([]);
  const checks = ko.observableArray([]);
  const ranAt = ko.observable(null);
  const remoteStatus = ko.observable('idle');
  const remoteError = ko.observable(null);
  const ignores = createIgnores({
    ko,
    url: metadata.url && metadata.url.qualityIgnores,
    initial: metadata.qualityIgnores || [],
    persist: deps.persist,
    onError: (err) => {
      console.error('Storing an ignored quality finding failed', err);
      notify('error', t('The change could not be saved'));
    },
  });
  // Bumped by every run and cancel: a result that comes back late is dropped.
  let runId = 0;
  // The server runs one check at a time per user: a request waits for the
  // previous one, and is not sent at all if a newer run replaced it.
  let inFlight = Promise.resolve();
  let cancelRemote = null;
  // The local results the server's checks complete.
  let lastLocal = null;
  // Each change of the email bumps the content version; results carry the
  // version they were computed on, and are stale as soon as they differ.
  let contentVersion = 0;
  let runVersion = 0;
  let resultVersion = -1;
  // The review of an export that could not open the drawer said so once.
  let notifiedRun = 0;

  const isIgnored = (finding) => ignores.has(finding.fingerprint);
  const active = ko.pureComputed(() => findings().filter((f) => !isIgnored(f)));
  const countOf = (...severities) =>
    ko.pureComputed(
      () => active().filter((f) => severities.includes(f.severity)).length
    );
  const issueCount = countOf('error', 'warning');

  const freshness = () => (resultVersion === contentVersion ? 'done' : 'stale');

  function apply(result) {
    findings(result.findings);
    checks(result.checks);
    ranAt(new Date());
    resultVersion = runVersion;
    status(freshness());
    return result;
  }

  function settle() {
    status(ranAt() ? freshness() : 'idle');
  }

  watch(viewModel, ko, () => {
    contentVersion++;
    if (status() === 'done') status('stale');
  });

  // Whether the comments panel holds a comment being written: opening the
  // drawer would close it (qualityDrawerPlugin.js).
  const commentDraftInProgress = () =>
    Boolean(ko.unwrap(viewModel.showComments)) &&
    String(ko.unwrap(viewModel.newCommentText) || '').trim().length > 0;

  // After an export, the results open the drawer when there is something to
  // fix, the same rule as the toolbar badge: errors and warnings, not infos.
  function surface(id) {
    if (!issueCount()) return;
    if (!viewModel.showQuality() && commentDraftInProgress()) {
      if (notifiedRun === id) return;
      notifiedRun = id;
      notify(
        'warning',
        t('__count__ issues to fix: open the quality control', {
          count: issueCount(),
        })
      );
      return;
    }
    viewModel.quality.open('checks');
  }

  function remoteResults(local, remote) {
    if (local.ctx && typeof runRules === 'function') {
      local.ctx.remote = remote;
      return runRules(local.ctx, REMOTE_RULES);
    }
    // An engine that hands no context back: the export is read again.
    return run(viewModel, { html: local.html, rules: REMOTE_RULES, remote });
  }

  // The server's checks, on the export the local ones just read. Their
  // results join the others when they come back, unless a newer run started.
  function runRemote(id, local, { silent = false } = {}) {
    if (!resourcesUrl || !hasResources(local.resources)) {
      remoteStatus('idle');
      return Promise.resolve();
    }
    lastLocal = local;
    remoteStatus('running');
    remoteError(null);
    const cancel = remoteApi.createCancel();
    cancelRemote = cancel;
    const request = inFlight
      .catch(() => {})
      .then(() =>
        id === runId
          ? checkResources(resourcesUrl, local.resources, {
              cancelToken: cancel.token,
            })
          : null
      );
    inFlight = request;
    return request
      .then((remote) => {
        if (id !== runId) return;
        const result = remoteResults(local, remote);
        findings(local.findings.concat(result.findings));
        checks(local.checks.concat(result.checks));
        remoteStatus('done');
        if (!silent) surface(id);
      })
      .catch((err) => {
        if (id !== runId) return;
        console.error('Quality checks on the server failed', err);
        // Listed as checks that could not run, never as passed. A blocklist
        // may not even be configured: it is left out.
        checks(
          local.checks.concat(listedRemoteRules.map(remoteCheck('error')))
        );
        remoteError(remoteApi.isTooFrequent(err) ? 'too-frequent' : 'failed');
        remoteStatus('error');
      });
  }

  // Runs the local checks at once, then the server's in the background.
  function runAll(id, options, remoteOptions) {
    const local = apply(run(viewModel, options));
    runRemote(id, local, remoteOptions);
    return local;
  }

  function start(id, options, { silent } = {}) {
    runVersion = contentVersion;
    status('running');
    defer(() => {
      if (id !== runId) return;
      try {
        runAll(id, options, { silent });
        if (!silent) surface(id);
      } catch (err) {
        console.error('Quality review failed', err);
        settle();
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
    ignored: ignores.ignored,
    canIgnore: ignores.canIgnore,
    remoteStatus,
    remoteError,
    // Blocklists are left out: they only run where they are configured.
    ruleCount:
      DEFAULT_RULES.length + (resourcesUrl ? listedRemoteRules.length : 0),
    // The findings still to deal with, and those the team chose to ignore.
    activeFindings: active,
    ignoredFindings: ko.pureComputed(() => findings().filter(isIgnored)),
    errorCount: countOf('error'),
    // What the toolbar badge counts: what should be fixed, not the infos.
    issueCount,
    passedCount: ko.pureComputed(
      () => checks().filter((c) => c.status === 'passed').length
    ),

    /** Opens the drawer on a tab: 'checks' or 'send'. */
    open(name = 'checks') {
      tab(name);
      viewModel.showQuality(true);
    },

    ignore: (finding) => ignores.set(finding, true),
    unignore: (finding) => ignores.set(finding, false),

    run() {
      start(++runId, undefined, { silent: true });
    },

    /** Stops the run: the request to the server is aborted. */
    cancel() {
      runId++;
      if (cancelRemote) cancelRemote.cancel();
      if (remoteStatus() === 'running') {
        // Not run, and said so: they never count as passed.
        if (lastLocal) {
          checks(
            lastLocal.checks.concat(
              listedRemoteRules.map(remoteCheck('cancelled'))
            )
          );
        }
        remoteStatus('idle');
      }
      settle();
    },

    /**
     * Reviews the HTML an export is about to send. Never blocks the export:
     * the HTML is taken at once, the checks run after the click, a failure is
     * logged, and the server's checks come back in the background.
     * @param {Object} [options]
     * @param {string} [options.html] - the HTML already exported
     * @param {boolean} [options.silent] - never open the drawer nor change its tab
     * @returns {null}
     */
    review(options = {}) {
      const id = ++runId;
      try {
        const html =
          typeof options.html === 'string'
            ? options.html
            : viewModel.exportHTML();
        start(id, { html }, { silent: Boolean(options.silent) });
      } catch (err) {
        console.error('Quality review failed', err);
        settle();
      }
      return null;
    },
  };
}

module.exports = { installQualityReview };
