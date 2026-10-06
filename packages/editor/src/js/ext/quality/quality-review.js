'use strict';

const engine = require('./engine');
const { createIgnores } = require('./quality-ignores');
const { createCounts } = require('./quality-counts');
const remoteApi = require('./quality-remote');
const { watchContent } = require('./content-watch');
const { checkStateOf } = require('./settings');
const { installQualityGate } = require('./quality-gate');
const { createRemoteChecks, listedRemoteRules } = require('./remote-checks');
const { installRightPanel } = require('../right-panel.js');

const { runQualityChecks, DEFAULT_RULES, REMOTE_RULES } = engine;

// The state of the last quality review, shared by the drawer, the toolbar
// button and the commands that export the email (download, ESP send).
//   status: 'idle' (never run) | 'running' | 'done' | 'stale' (the email
//     changed since the results were computed)
//   remoteStatus: the checks the server runs (links, image weight), which
//     come after the others: 'idle' | 'running' | 'done' | 'error'
//   remoteError: why the server's checks did not run: 'too-frequent' | 'failed'
// Findings the team ignored are kept apart (quality-ignores.js).

/**
 * Adds `viewModel.showQuality` and `viewModel.quality` to the editor.
 * @param {Object} viewModel
 * @param {Object} ko - knockout
 * @param {Object} [deps] - injectable for tests
 */
function installQualityReview(viewModel, ko, deps = {}) {
  const run = deps.run || runQualityChecks;
  // `runRules(ctx, rules)` of the engine (remote-checks.js).
  const runRules = deps.runRules || engine.runRules;
  // Lets the drawer paint its "running" state before a synchronous run.
  const defer = deps.defer || ((fn) => setTimeout(fn, 0));
  const checkResources = deps.checkResources || remoteApi.postResources;
  const watch = deps.watchContent || watchContent;
  const metadata = viewModel.metadata || {};
  const resourcesUrl = metadata.url && metadata.url.qualityResources;
  // The mailing's quality settings (ADR 0009): a check turned off is neither
  // run, nor listed, nor counted; the drawer only says how many are off.
  const settings = { config: { quality: metadata.qualitySettings || null } };
  const isOn = (rule) => checkStateOf(settings, rule.id) !== 'off';
  const localRules = DEFAULT_RULES.filter(isOn);
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
  const focus = ko.observable(null);
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
  // Each change of the email bumps the content version; results carry the
  // version they were computed on, and are stale as soon as they differ.
  let contentVersion = 0;
  let runVersion = 0;
  let resultVersion = -1;
  // The review of an export that could not open the drawer said so once.
  let notifiedRun = 0;

  // A finding that blocks cannot be ignored: an ignore stored before its
  // check became blocking no longer hides it (ADR 0009). The lower levels of
  // a blocking check do not block: their ignores still hold.
  const isIgnored = (finding) =>
    !finding.blocking && ignores.has(finding.fingerprint);
  const active = ko.pureComputed(() => findings().filter((f) => !isIgnored(f)));
  const counts = createCounts(ko, { active, checks });
  const { issueCount } = counts;

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

  const remote = createRemoteChecks({
    state: { findings, checks, remoteStatus, remoteError },
    isCurrent: (id) => id === runId,
    surface,
    isOn,
    url: resourcesUrl,
    checkResources,
    run: (options) => run(viewModel, options),
    runRules,
  });

  // Runs the local checks at once, then the server's in the background; the
  // promise settles once the server answered (or failed).
  function runAll(id, options, remoteOptions) {
    const local = apply(run(viewModel, options));
    return { local, remote: remote.run(id, local, remoteOptions) };
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

  // A check the server runs is blocking: an export waits for its answer.
  const remoteBlocking = REMOTE_RULES.some(
    (rule) => checkStateOf(settings, rule.id) === 'blocking'
  );

  // One of the right panels: opening it closes the comments or the AI panel
  // (ADR 0010).
  viewModel.showQuality = installRightPanel(viewModel, ko).flag('quality');
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
    ruleCount: localRules.length + (resourcesUrl ? remote.listedCount : 0),
    // How many checks the quality settings turned off, for the drawer to say.
    turnedOffCount:
      DEFAULT_RULES.length +
      listedRemoteRules.length -
      localRules.length -
      remote.listedCount,
    // The findings still to deal with, and those the team chose to ignore.
    activeFindings: active,
    ignoredFindings: ko.pureComputed(() => findings().filter(isIgnored)),
    ...counts,

    /** Opens the drawer on a tab: 'checks' or 'send'. */
    open(name = 'checks') {
      tab(name);
      viewModel.showQuality(true);
    },

    // The row of a finding the drawer is asked to show (`reveal`).
    focus,

    /** Opens the drawer on the row of a finding, unfolded. */
    reveal(finding) {
      // A new object each time: the same finding shown twice moves there twice.
      focus({ fingerprint: finding && finding.fingerprint });
      viewModel.quality.open('checks');
    },

    ignore: (finding) =>
      finding.blocking ? Promise.resolve() : ignores.set(finding, true),
    unignore: (finding) => ignores.set(finding, false),

    run() {
      start(++runId, undefined, { silent: true });
    },

    /** Stops the run: the request to the server is aborted. */
    cancel() {
      runId++;
      remote.cancel();
      settle();
    },

    /**
     * Reviews the HTML a test is about to send. Never blocks the send:
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

  // For the export gate (quality-gate.js): start a run on the HTML about to
  // leave (`cancel`, `purpose` of its request), show its results again.
  const runs = {
    start({ html, quiet = false, ...request }) {
      const id = ++runId;
      runVersion = contentVersion;
      let started;
      try {
        // A gate needs the server's answer even if a later run starts.
        const ask = { ...request, silent: quiet, answer: remoteBlocking };
        started = runAll(id, { html }, ask);
      } catch (err) {
        settle();
        throw err;
      }
      if (!quiet) surface(id);
      return {
        ...started,
        id,
        version: runVersion,
        at: ranAt(),
        // The export waits: a check of the server blocks, and it was asked.
        waits: remoteBlocking && remoteStatus() === 'running',
      };
    },
    isCurrent: (id) => id === runId,
    // A run another one replaced in the drawer gets it back, then the drawer
    // opens when there is something to fix.
    present(run, latest) {
      if (run.id !== runId) {
        runId++;
        remote.abortPending();
        findings(latest.findings);
        checks(latest.checks);
        ranAt(run.at);
        resultVersion = run.version;
        remoteStatus(latest.status);
        remoteError(latest.failure);
        status(freshness());
      }
      surface(runId);
    },
  };

  installQualityGate(viewModel, ko, { ...deps, runs });
}

module.exports = { installQualityReview };
