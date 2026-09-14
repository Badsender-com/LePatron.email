'use strict';

const {
  planInvocationMigration,
  OLD_FIELD,
  NEW_FIELD,
} = require('../../scripts/migrate-invocation-source');

describe('migrate-invocation-source.planInvocationMigration', () => {
  it('renames a document that still carries the old field', () => {
    expect(planInvocationMigration({ [OLD_FIELD]: 'playground' })).toEqual({
      action: 'rename',
      value: 'playground',
    });
  });

  it('carries a null value across rather than dropping the field', () => {
    expect(planInvocationMigration({ [OLD_FIELD]: null })).toEqual({
      action: 'rename',
      value: null,
    });
  });

  // Idempotence: re-running the migration must be a no-op.
  it('skips a document already migrated', () => {
    const plan = planInvocationMigration({ [NEW_FIELD]: 'translation' });
    expect(plan.action).toBe('skip');
    expect(plan.reason).toMatch(/already migrated/);
  });

  it('skips a document with neither field', () => {
    expect(planInvocationMigration({}).action).toBe('skip');
  });

  // $rename fails outright on a document holding both, so it is reported
  // instead of aborting the run; the new value wins.
  it('skips a document carrying both fields, and says so', () => {
    const plan = planInvocationMigration({
      [OLD_FIELD]: 'playground',
      [NEW_FIELD]: 'translation',
    });
    expect(plan.action).toBe('skip');
    expect(plan.reason).toContain('both fields');
    expect(plan.reason).toContain('translation');
  });
});
