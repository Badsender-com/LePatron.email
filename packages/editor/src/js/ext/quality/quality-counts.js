'use strict';

/**
 * What the toolbar button and the drawer count of a review's results
 * (quality-review.js), as knockout computeds.
 * @param {Object} ko - knockout
 * @param {Object} state
 * @param {Function} state.active - the findings not ignored
 * @param {Function} state.checks - one entry per check, with its status
 */
function createCounts(ko, { active, checks }) {
  const countOf = (...severities) =>
    ko.pureComputed(
      () => active().filter((f) => severities.includes(f.severity)).length
    );
  // What the toolbar badge counts: what should be fixed, not the infos.
  const issueCount = countOf('error', 'warning');
  // A check that could not run, or was cancelled, was never judged: no green
  // tick while one is left, as the drawer's "all passed" (allPassed).
  const ranCount = ko.pureComputed(
    () =>
      checks().filter((c) => c.status !== 'error' && c.status !== 'cancelled')
        .length
  );
  return {
    errorCount: countOf('error'),
    issueCount,
    passedCount: ko.pureComputed(
      () => checks().filter((c) => c.status === 'passed').length
    ),
    ranCount,
    // Nothing to fix, every check judged. A check whose findings are ignored
    // or only infos is not "passed", and still clears the email.
    cleared: ko.pureComputed(
      () => issueCount() === 0 && ranCount() === checks().length
    ),
  };
}

module.exports = { createCounts };
