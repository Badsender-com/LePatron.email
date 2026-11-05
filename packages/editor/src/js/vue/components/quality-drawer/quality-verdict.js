'use strict';

/**
 * Where the email stands after a run (ADR 0020, boards q2, q3), said the
 * same way by the card of the drawer and to screen readers: ready, not ready
 * with what blocks the export (red, decision 6), not ready, or a check that
 * could not run.
 *
 * @param {{ ready: boolean, issueCount: number, blockingCount: number }} state
 * @param {Function} t - the editor's translation
 * @returns {{ kind: string, icon: string, title: string, textKey: string }}
 */
function verdictOf({ ready, issueCount, blockingCount }, t) {
  if (ready) {
    return {
      kind: 'ready',
      icon: 'lucide-check-circle',
      title: t('quality-ready-title'),
      textKey: 'quality-ready-text',
    };
  }
  if (!issueCount) {
    return {
      kind: 'incomplete',
      icon: 'lucide-circle-slash',
      title: t('quality-not-run-title'),
      textKey: 'quality-not-run-text',
    };
  }
  // « Pas prêt : 3 points à corriger, dont 1 bloquant »: one or many each.
  const left = t(issueCount === 1 ? 'quality-not-ready-one' : 'quality-not-ready', {
    count: issueCount,
  });
  if (!blockingCount) {
    return {
      kind: 'todo',
      icon: 'lucide-triangle-alert',
      title: left,
      textKey: 'quality-not-ready-text',
    };
  }
  const blocking = t(
    blockingCount === 1 ? 'quality-blocking-suffix-one' : 'quality-blocking-suffix',
    { count: blockingCount }
  );
  return {
    kind: 'blocking',
    icon: 'lucide-lock',
    title: `${left}${blocking}`,
    textKey: 'quality-blocking-text',
  };
}

module.exports = { verdictOf };
