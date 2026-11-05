'use strict';

/**
 * What the toolbar button and the drawer count of a review's results
 * (quality-review.js), as knockout computeds.
 * @param {Object} ko - knockout
 * @param {Object} state
 * @param {Function} state.active - the findings not ignored
 * @param {Function} state.checks - one entry per check, with its status
 * @param {Function} [state.remoteStatus] - the server's checks, which come
 *   after the others: 'running' while they are awaited
 */
function createCounts(ko, { active, checks, remoteStatus = () => 'idle' }) {
  // What the toolbar badge counts: what should be fixed, not the infos,
  // unless they block an export.
  const issueCount = ko.pureComputed(
    () =>
      active().filter(
        (f) => f.blocking || f.severity === 'error' || f.severity === 'warning'
      ).length
  );
  // A check that could not run, or was cancelled, was never judged: the email
  // is not ready while one is left.
  const ranCount = ko.pureComputed(
    () =>
      checks().filter((c) => c.status !== 'error' && c.status !== 'cancelled')
        .length
  );
  return {
    issueCount,
    // The findings that stop an export (ADR 0009).
    blockingCount: ko.pureComputed(
      () => active().filter((f) => f.blocking).length
    ),
    passedCount: ko.pureComputed(
      () => checks().filter((c) => c.status === 'passed').length
    ),
    ranCount,
    // The ready rule (ADR 0020), the one of the rail badge, the card of the
    // drawer and the banner of the send test tab: nothing to fix, every check
    // judged, the server's included. A check whose findings are ignored or
    // only infos is not "passed", and the email is still ready. No check, no
    // verdict.
    ready: ko.pureComputed(
      () =>
        checks().length > 0 &&
        issueCount() === 0 &&
        ranCount() === checks().length &&
        remoteStatus() !== 'running'
    ),
  };
}

module.exports = { createCounts };
