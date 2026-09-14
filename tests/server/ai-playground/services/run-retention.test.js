'use strict';

const {
  runExpiresAt,
} = require('../../../../packages/server/ai-playground/services/run-retention.service');
const {
  DefaultPlaygroundRunRetentionDays,
} = require('../../../../packages/server/ai-playground/constant/playground-constants');

describe('runExpiresAt', () => {
  it('stamps the deadline one retention window after creation', () => {
    expect(runExpiresAt(new Date('2026-12-01T00:00:00Z'), 365)).toEqual(
      new Date('2027-12-01T00:00:00Z')
    );
  });

  it('falls back to the default retention window', () => {
    expect(DefaultPlaygroundRunRetentionDays).toBe(365);
    expect(runExpiresAt(new Date('2026-12-01T00:00:00Z'))).toEqual(
      new Date('2027-12-01T00:00:00Z')
    );
  });

  it('returns a past deadline for a run whose window already closed', () => {
    // A run kept alive as golden past its window: on unmark the TTL monitor
    // must collect it, not grant it a fresh year.
    const expiresAt = runExpiresAt(new Date('2020-01-01T00:00:00Z'));
    expect(expiresAt.getTime()).toBeLessThan(Date.now());
  });
});
