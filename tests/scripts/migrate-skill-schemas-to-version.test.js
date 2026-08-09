'use strict';

const {
  planSkillMigration,
} = require('../../scripts/migrate-skill-schemas-to-version');

describe('migrate-skill-schemas-to-version.planSkillMigration', () => {
  it('backfills each version from the root schemas', () => {
    const versions = planSkillMigration({
      inputSchemaId: 'genericTextInput',
      outputSchemaId: 'genericTextOutput',
      versions: [
        { versionMajor: 1, versionMinor: 0 },
        { versionMajor: 2, versionMinor: 0 },
      ],
    });
    expect(versions).toHaveLength(2);
    for (const v of versions) {
      expect(v.inputSchemaId).toBe('genericTextInput');
      expect(v.outputSchemaId).toBe('genericTextOutput');
    }
  });

  it('does not overwrite a version that already carries its own schemas', () => {
    const versions = planSkillMigration({
      inputSchemaId: 'genericTextInput',
      outputSchemaId: 'genericTextOutput',
      versions: [
        {
          versionMajor: 1,
          versionMinor: 0,
          inputSchemaId: 'other',
          outputSchemaId: 'otherOut',
        },
      ],
    });
    expect(versions[0].inputSchemaId).toBe('other');
    expect(versions[0].outputSchemaId).toBe('otherOut');
  });

  it('is idempotent — a skill with no root schemas is skipped (returns null)', () => {
    expect(
      planSkillMigration({ versions: [{ versionMajor: 1, versionMinor: 0 }] })
    ).toBeNull();
  });
});
