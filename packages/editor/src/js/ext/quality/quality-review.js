'use strict';

const axios = require('axios');
const { runQualityChecks, DEFAULT_RULES, REMOTE_RULES } = require('./engine');
const { hasResources } = require('./resources');
const { checkStateOf } = require('./settings');
const { displayBlockingFindings } = require('../badsender-control-quality');

// The state of the last quality review, shared by the drawer, the toolbar
// button and the commands that export the email (download, ESP send).
//   status: 'idle' (never run) | 'running' | 'done'
//   remoteStatus: the checks the server runs (links, image weight), which
//     come after the others: 'idle' | 'running' | 'done' | 'error'
// Findings the team ignored are kept apart: they are stored on the email
// (PATCH /mailings/:id/quality-ignores) and shared by everyone who edits it.

// Stores one "ignore" change; resolves with the fingerprints the server keeps.
function patchIgnore(url, change) {
  return axios.patch(url, change).then((response) => response.data.qualityIgnores);
}

// The server answers within 20 s (quality-resources.service.js): past this,
// something went wrong on the way.
const RESOURCES_TIMEOUT_MS = 40000;
const RETRY_DELAY_MS = 3000;

// Asks the server about the links and images; resolves with its answer. A 429
// (another tab of the same user is checking) is tried once more, a bit later.
function postResources(url, resources, retried = false) {
  return axios
    .post(url, resources, { timeout: RESOURCES_TIMEOUT_MS })
    .then((response) => response.data)
    .catch((err) => {
      if (retried || !err.response || err.response.status !== 429) throw err;
      return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS)).then(
        () => postResources(url, resources, true)
      );
    });
}

// The server's checks that are always listed; a blocklist is only where the
// platform subscribed to one.
const listedRemoteRules = REMOTE_RULES.filter((rule) => !rule.optional);

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
  const checkResources = deps.checkResources || postResources;
  const metadata = viewModel.metadata || {};
  const ignoreUrl = metadata.url && metadata.url.qualityIgnores;
  const resourcesUrl = metadata.url && metadata.url.qualityResources;
  // The mailing's quality settings (ADR 0004): a check turned off is neither
  // run, nor listed, nor counted; the drawer only says how many are off.
  const settings = { config: { quality: metadata.qualitySettings || null } };
  const isOn = (rule) => checkStateOf(settings, rule.id) !== 'off';
  const localRules = DEFAULT_RULES.filter(isOn);
  const remoteRules = listedRemoteRules.filter(isOn);
  const turnedOffCount =
    DEFAULT_RULES.length +
    listedRemoteRules.length -
    localRules.length -
    remoteRules.length;

  const status = ko.observable('idle');
  const findings = ko.observableArray([]);
  const checks = ko.observableArray([]);
  const ranAt = ko.observable(null);
  const remoteStatus = ko.observable('idle');
  const ignored = ko.observableArray((metadata.qualityIgnores || []).slice());
  // Bumped by every run and cancel: a result that comes back late is dropped.
  let runId = 0;
  // The server runs one check at a time per user: a request waits for the
  // previous one, and is not sent at all if a newer run replaced it.
  let inFlight = Promise.resolve();

  // A finding of a blocking check cannot be ignored: an ignore stored before
  // the check became blocking no longer hides it (ADR 0004).
  const isIgnored = (finding) =>
    !finding.blocking && ignored.indexOf(finding.fingerprint) !== -1;
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

  // The server's checks, on the export the local ones just read. Their
  // results join the others when they come back, unless a newer run started.
  // After an export, the drawer opens if they find something to fix.
  function runRemote(id, local, { openOnIssues = false } = {}) {
    // Nothing to ask the server when every check it serves is off.
    const remoteOn = REMOTE_RULES.some(isOn);
    if (!resourcesUrl || !remoteOn || !hasResources(local.resources)) {
      remoteStatus('idle');
      return Promise.resolve();
    }
    remoteStatus('running');
    const request = inFlight
      .catch(() => {})
      .then(() =>
        id === runId ? checkResources(resourcesUrl, local.resources) : null
      );
    inFlight = request;
    return request
      .then((remote) => {
        if (id !== runId) return;
        const result = run(viewModel, {
          html: local.html,
          rules: REMOTE_RULES,
          remote,
        });
        findings(local.findings.concat(result.findings));
        checks(local.checks.concat(result.checks));
        remoteStatus('done');
        const issues = result.findings.filter(
          (f) => !isIgnored(f) && (f.severity === 'error' || f.severity === 'warning')
        );
        if (openOnIssues && issues.length) viewModel.quality.open('checks');
      })
      .catch((err) => {
        if (id !== runId) return;
        console.error('Quality checks on the server failed', err);
        // Listed as checks that could not run, never as passed. A blocklist
        // may not even be configured: it is left out.
        const failed = remoteRules.map(
          (rule) => ({
            ruleId: rule.id,
            category: rule.category,
            titleKey: rule.titleKey,
            status: 'error',
          })
        );
        checks(local.checks.concat(failed));
        remoteStatus('error');
      });
  }

  // Runs the local checks at once, then the server's in the background; the
  // promise settles once the server answered (or failed).
  function runAll(id, options, remoteOptions) {
    const local = apply(run(viewModel, options));
    const remote = runRemote(id, local, remoteOptions);
    return { local, remote };
  }

  // A check the server runs is blocking: an export must wait for its answer.
  const remoteBlocking = REMOTE_RULES.some(
    (rule) => checkStateOf(settings, rule.id) === 'blocking'
  );

  // Shown at once, stored in the background, put back as it was on failure.
  function setIgnored(finding, value) {
    const { fingerprint, ruleId } = finding;
    if (finding.blocking) return Promise.resolve();
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
    remoteStatus,
    // Blocklists are left out: they only run where they are configured.
    ruleCount: localRules.length + (resourcesUrl ? remoteRules.length : 0),
    // How many checks the quality settings turned off, for the drawer to say.
    turnedOffCount: ko.pureComputed(() => turnedOffCount),
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

    // Whether an export will wait for the server's checks: one of them blocks.
    waitsForServer: () => Boolean(resourcesUrl) && remoteBlocking,

    ignore: (finding) => setIgnored(finding, true),
    unignore: (finding) => setIgnored(finding, false),

    run() {
      const id = ++runId;
      status('running');
      defer(() => {
        if (id !== runId) return;
        try {
          runAll(id);
        } catch (err) {
          console.error('Quality review failed', err);
          settle();
        }
      });
    },

    cancel() {
      runId++;
      if (remoteStatus() === 'running') remoteStatus('idle');
      settle();
    },

    /**
     * Decides whether an export may leave: runs the checks on the HTML about
     * to leave, opens the drawer when there is something to see, and, when a
     * finding of a blocking check remains, lists them in a modal. The export
     * is stopped by the caller on `blocked`. A failure of the checks never
     * blocks.
     * @param {Object} [options] - `html`: the HTML already exported
     * @returns {Promise<{ blocked: boolean, findings: Array }>}
     */
    gate(options = {}) {
      const { quiet = false, ...runOptions } = options;
      const id = ++runId;
      let remote;
      try {
        ({ remote } = runAll(id, runOptions, { openOnIssues: !quiet }));
      } catch (err) {
        console.error('Quality review failed', err);
        settle();
        return Promise.resolve({ blocked: false, findings: [] });
      }
      // The server's answer only matters when one of its checks blocks; its
      // failure never blocks (runRemote catches it).
      const waited =
        remoteBlocking && remoteStatus() === 'running' ? remote : Promise.resolve();
      return waited.then(() => {
        const findings = active().filter((finding) => finding.blocking);
        // Quiet: before an ESP send, the drawer only opens on what blocks.
        if ((quiet ? findings.length : active().length) && id === runId) {
          viewModel.quality.open('checks');
        }
        if (findings.length) displayBlockingFindings(findings, viewModel);
        return { blocked: findings.length > 0, findings };
      });
    },

    /**
     * Reviews the HTML an export is about to send, and opens the drawer when
     * there is something to see. Never blocks the export: a failure is logged,
     * and the server's checks come back in the background, after the export.
     * @param {Object} [options] - `html`: the HTML already exported
     */
    review(options) {
      const id = ++runId;
      try {
        const { local } = runAll(id, options, { openOnIssues: true });
        if (active().length) viewModel.quality.open('checks');
        return local;
      } catch (err) {
        console.error('Quality review failed', err);
        settle();
        return null;
      }
    },
  };
}

module.exports = { installQualityReview };
