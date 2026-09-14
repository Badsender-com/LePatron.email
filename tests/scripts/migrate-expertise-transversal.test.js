'use strict';

const {
  planTransversalMigration,
  TRANSVERSAL_ALLOWLIST,
} = require('../../scripts/migrate-expertise-transversal');

describe('migrate-expertise-transversal.planTransversalMigration', () => {
  it('flags the allow-listed brand-voice expertise', () => {
    expect(TRANSVERSAL_ALLOWLIST).toContain('redaction.brand-voice-defaults');
    const { toFlag } = planTransversalMigration([
      {
        expertiseId: 'redaction.brand-voice-defaults',
        scope: [],
        isTransversal: false,
      },
    ]);
    expect(toFlag).toEqual(['redaction.brand-voice-defaults']);
  });

  it('is idempotent — an already-transversal allow-listed doc is not re-flagged', () => {
    const { toFlag, alreadyOk } = planTransversalMigration([
      {
        expertiseId: 'redaction.brand-voice-defaults',
        scope: [],
        isTransversal: true,
      },
    ]);
    expect(toFlag).toEqual([]);
    expect(alreadyOk).toBe(1);
  });

  it('does NOT flag a non-allow-listed empty-scope expertise, but warns about it', () => {
    const { toFlag, emptyScopeWarnings } = planTransversalMigration([
      { expertiseId: 'redaction.orphan', scope: [], isTransversal: false },
    ]);
    expect(toFlag).toEqual([]);
    expect(emptyScopeWarnings).toEqual(['redaction.orphan']);
  });

  it('ignores a scoped, non-allow-listed expertise (no flag, no warning)', () => {
    const { toFlag, emptyScopeWarnings } = planTransversalMigration([
      {
        expertiseId: 'redaction.cta.principes',
        scope: ['cta'],
        isTransversal: false,
      },
    ]);
    expect(toFlag).toEqual([]);
    expect(emptyScopeWarnings).toEqual([]);
  });
});
