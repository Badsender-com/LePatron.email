'use strict';

// The nature of a skill moved from the skill to each version (commit
// beb675c80, ADR 0013): a skill written before keeps it on the skill, its
// versions carry none, and is then read as a feature skill. The migration
// copies the skill's nature onto each version that has none, and removes it
// from the skill.

const {
  planNatureMigration,
} = require('../../scripts/migrate-skill-nature-to-version.js');

const task = (versions) => ({ skillId: 'qc.audit', nature: 'task', versions });

describe('migrate-skill-nature-to-version', () => {
  it('gives each version without a nature the nature of its skill', () => {
    const versions = planNatureMigration(
      task([
        { versionMajor: 1, versionMinor: 0, status: 'ARCHIVED' },
        { versionMajor: 1, versionMinor: 1, status: 'ACTIVE' },
      ])
    );

    expect(versions.map((v) => v.nature)).toEqual(['task', 'task']);
  });

  it('keeps the nature a version already has', () => {
    const versions = planNatureMigration(
      task([
        { versionMajor: 1, versionMinor: 0, nature: 'feature' },
        { versionMajor: 2, versionMinor: 0 },
      ])
    );

    expect(versions.map((v) => v.nature)).toEqual(['feature', 'task']);
  });

  it('keeps everything else of a version', () => {
    const [version] = planNatureMigration(
      task([{ versionMajor: 1, versionMinor: 0, procedure: '## Lire' }])
    );

    expect(version).toEqual({
      versionMajor: 1,
      versionMinor: 0,
      procedure: '## Lire',
      nature: 'task',
    });
  });

  it.each([
    ['no nature on the skill', { skillId: 'redaction.objet', versions: [] }],
    [
      'a null nature on the skill',
      { skillId: 'redaction.objet', nature: null, versions: [] },
    ],
  ])('has nothing to do for a skill with %s', (_case, doc) => {
    expect(planNatureMigration(doc)).toBeNull();
  });
});
