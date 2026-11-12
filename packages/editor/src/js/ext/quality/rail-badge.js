'use strict';

/**
 * The badge of « Tester l'email » in the panel rail (ADR 0020, decision 6): red
 * counts only what blocks the export, the accent counts the rest to fix, a
 * green tick says the email is ready. The states the board does not draw say
 * what they are: running, stale, a check that could not run.
 *
 * @param {Object} state - the quality review's observables
 * @returns {null|{ kind: string, count?: number, labelKey: string,
 *   params?: Object }} what the badge shows, and how it is said
 */
function railBadgeOf({
  status,
  blockingCount,
  issueCount,
  ready,
  ranCount,
  total,
  remoteStatus = 'idle',
}) {
  if (status === 'running') return { kind: 'running', labelKey: 'Running…' };
  if (status === 'stale') {
    return { kind: 'stale', labelKey: 'quality-badge-stale' };
  }
  if (status !== 'done') return null;
  if (blockingCount > 0) {
    return {
      kind: 'blocking',
      count: blockingCount,
      labelKey:
        blockingCount === 1 ? 'panel-rail-blocking-one' : 'panel-rail-blocking',
      params: { count: blockingCount },
    };
  }
  if (issueCount > 0) {
    return {
      kind: 'volume',
      count: issueCount,
      labelKey: '__count__ issues',
      params: { count: issueCount },
    };
  }
  if (ready) return { kind: 'ready', labelKey: 'panel-rail-ready' };
  // Nothing found yet, the server's checks still awaited.
  if (remoteStatus === 'running') {
    return { kind: 'running', labelKey: 'Running…' };
  }
  // Nothing to fix, but a check could not run: no green tick.
  return {
    kind: 'incomplete',
    labelKey: '__passed__ of __total__ checks passed',
    params: { passed: ranCount, total },
  };
}

/** The badge as a Knockout computed, over the review's observables. */
function createRailBadge(ko, quality) {
  return ko.pureComputed(() =>
    railBadgeOf({
      status: quality.status(),
      blockingCount: quality.blockingCount(),
      issueCount: quality.issueCount(),
      ready: quality.ready(),
      ranCount: quality.ranCount(),
      total: quality.checks().length,
      remoteStatus: quality.remoteStatus(),
    })
  );
}

module.exports = { railBadgeOf, createRailBadge };
