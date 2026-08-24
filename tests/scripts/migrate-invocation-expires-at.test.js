'use strict';

const { Types } = require('mongoose');
const {
  planExpiresAt,
} = require('../../scripts/migrate-invocation-expires-at');

const GROUP_A = new Types.ObjectId();
const GROUP_B = new Types.ObjectId();
const NOW = new Date('2026-08-20T12:00:00Z');

const retentionByGroup = new Map([
  [String(GROUP_A), 7],
  [String(GROUP_B), 90],
]);

describe('migrate-invocation-expires-at.planExpiresAt', () => {
  it("stamps startedAt + the Group's retention", () => {
    const at = planExpiresAt(
      { _company: GROUP_A, startedAt: new Date('2026-08-01T00:00:00Z') },
      retentionByGroup,
      NOW
    );
    expect(at.toISOString()).toBe('2026-08-08T00:00:00.000Z');
  });

  it('uses each Group own retention, not a shared one', () => {
    const at = planExpiresAt(
      { _company: GROUP_B, startedAt: new Date('2026-08-01T00:00:00Z') },
      retentionByGroup,
      NOW
    );
    expect(at.toISOString()).toBe('2026-10-30T00:00:00.000Z');
  });

  it('falls back to the default retention for an unknown Group', () => {
    // 30 days from Aug 1 → Aug 31.
    const at = planExpiresAt(
      {
        _company: new Types.ObjectId(),
        startedAt: new Date('2026-08-01T00:00:00Z'),
      },
      retentionByGroup,
      NOW
    );
    expect(at.toISOString().slice(0, 10)).toBe('2026-08-31');
  });

  // Idempotence: re-running the migration must touch nothing.
  it('skips a document already stamped', () => {
    expect(
      planExpiresAt(
        {
          _company: GROUP_A,
          startedAt: new Date('2026-08-01T00:00:00Z'),
          expiresAt: new Date('2026-08-08T00:00:00Z'),
        },
        retentionByGroup,
        NOW
      )
    ).toBeNull();
  });

  // Retention never ran, so old logs are past due — they get a deadline in the
  // past on purpose, and Mongo deletes them on its next TTL pass.
  it('stamps a deadline in the past for a document beyond its window', () => {
    const at = planExpiresAt(
      { _company: GROUP_A, startedAt: new Date('2026-01-01T00:00:00Z') },
      retentionByGroup,
      NOW
    );
    expect(at.getTime()).toBeLessThan(NOW.getTime());
  });

  it('falls back to now for a document with no startedAt', () => {
    const at = planExpiresAt({ _company: GROUP_A }, retentionByGroup, NOW);
    expect(at.getTime()).toBe(NOW.getTime() + 7 * 24 * 60 * 60 * 1000);
  });
});
