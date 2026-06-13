'use strict';

const {
  planScenarioMigration,
  isFilterMode,
} = require('../../scripts/migrate-playground-filter-categories');

const categoryOf = (id) =>
  ({ 'redaction.cta': 'redaction', 'qc.subject': 'qc' }[id] || null);

describe('migrate-playground-filter-categories', () => {
  it('backfills categories from the skill category for filter-mode scenarios', () => {
    const { toUpdate } = planScenarioMigration(
      [
        {
          scenarioId: 's1',
          skillRef: { skillId: 'redaction.cta' },
          expertiseRefs: [],
          expertiseFilter: { scope: ['cta'] },
        },
      ],
      categoryOf
    );
    expect(toUpdate).toEqual([{ scenarioId: 's1', categories: ['redaction'] }]);
  });

  it('is idempotent — a scenario that already has categories is skipped', () => {
    const { toUpdate, skipped } = planScenarioMigration(
      [
        {
          scenarioId: 's1',
          skillRef: { skillId: 'redaction.cta' },
          expertiseRefs: [],
          expertiseFilter: { scope: ['cta'], categories: ['redaction'] },
        },
      ],
      categoryOf
    );
    expect(toUpdate).toEqual([]);
    expect(skipped).toBe(1);
  });

  it('does not touch explicit-refs scenarios', () => {
    const { toUpdate, skipped } = planScenarioMigration(
      [
        {
          scenarioId: 's1',
          skillRef: { skillId: 'redaction.cta' },
          expertiseRefs: [{ expertiseId: 'e1', mode: 'active' }],
          expertiseFilter: { scope: ['cta'] },
        },
      ],
      categoryOf
    );
    expect(toUpdate).toEqual([]);
    expect(skipped).toBe(1);
  });

  it('skips when the skill category cannot be resolved', () => {
    const { toUpdate, skipped } = planScenarioMigration(
      [
        {
          scenarioId: 's1',
          skillRef: { skillId: 'unknown' },
          expertiseRefs: [],
          expertiseFilter: { scope: ['cta'] },
        },
      ],
      categoryOf
    );
    expect(toUpdate).toEqual([]);
    expect(skipped).toBe(1);
  });

  it('isFilterMode: scope without refs is filter mode; empty scope is not', () => {
    expect(
      isFilterMode({ expertiseRefs: [], expertiseFilter: { scope: ['cta'] } })
    ).toBe(true);
    expect(
      isFilterMode({ expertiseRefs: [], expertiseFilter: { scope: [] } })
    ).toBe(false);
  });
});
