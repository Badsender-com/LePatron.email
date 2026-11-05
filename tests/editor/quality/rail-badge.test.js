'use strict';

// The badge of « Tester l'email » in the panel rail (ADR 0020, decision 6).

const {
  railBadgeOf,
} = require('../../../packages/editor/src/js/ext/quality/rail-badge.js');

const DONE = {
  status: 'done',
  blockingCount: 0,
  issueCount: 0,
  ready: false,
  ranCount: 3,
  total: 3,
};

describe("the badge of « Tester l'email » in the panel rail", () => {
  it('says nothing before a run', () => {
    expect(railBadgeOf({ ...DONE, status: 'idle' })).toBeNull();
  });

  it('counts in red only what blocks the export', () => {
    const badge = railBadgeOf({ ...DONE, blockingCount: 2, issueCount: 5 });
    expect(badge).toMatchObject({ kind: 'blocking', count: 2 });
    expect(badge.labelKey).toBe('panel-rail-blocking');
    expect(
      railBadgeOf({ ...DONE, blockingCount: 1, issueCount: 1 })
    ).toMatchObject({ labelKey: 'panel-rail-blocking-one' });
  });

  it('counts with the accent what is left to fix, nothing blocking', () => {
    expect(railBadgeOf({ ...DONE, issueCount: 3 })).toMatchObject({
      kind: 'volume',
      count: 3,
      params: { count: 3 },
    });
  });

  it('ticks a ready email', () => {
    expect(railBadgeOf({ ...DONE, ready: true })).toMatchObject({
      kind: 'ready',
      labelKey: 'panel-rail-ready',
    });
  });

  it("waits for the server's checks before saying anything else", () => {
    expect(railBadgeOf({ ...DONE, remoteStatus: 'running' })).toMatchObject({
      kind: 'running',
    });
    expect(
      railBadgeOf({ ...DONE, remoteStatus: 'running', issueCount: 1 })
    ).toMatchObject({ kind: 'volume' });
  });

  it('never ticks while a check could not run', () => {
    expect(railBadgeOf({ ...DONE, ranCount: 2 })).toMatchObject({
      kind: 'incomplete',
      params: { passed: 2, total: 3 },
    });
  });

  it.each([
    ['running', 'Running…'],
    ['stale', 'quality-badge-stale'],
  ])('says it is %s, whatever was found before', (status, labelKey) => {
    expect(
      railBadgeOf({ ...DONE, status, blockingCount: 1, issueCount: 1 })
    ).toMatchObject({ kind: status, labelKey });
  });
});
