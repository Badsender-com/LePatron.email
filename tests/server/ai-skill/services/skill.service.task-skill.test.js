'use strict';

// Publishing a task skill (ADR 0013): it has neither template nor schemas, so
// the schemas a feature skill needs are not asked of it; its procedure is. The
// nature is the version's: the gate is the one of the version published, and
// the version it replaces keeps its own.

jest.mock('../../../../packages/server/common/models.common', () => ({
  LePatronSkills: { findOne: jest.fn() },
}));

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const {
  LePatronSkills,
} = require('../../../../packages/server/common/models.common');

function skillWith(versions, activeVersion = { major: null, minor: 0 }) {
  return {
    skillId: 'qc.read-sending-report',
    status: activeVersion.major ? 'ACTIVE' : 'DRAFT',
    activeVersion,
    versions,
    save: jest.fn().mockImplementation(async function save() {
      return this;
    }),
  };
}

const draft = (version) => ({
  versionMajor: 1,
  versionMinor: 1,
  status: 'DRAFT',
  ...version,
});

const publish = () =>
  skillService.activateVersion(
    'qc.read-sending-report',
    { major: 1, minor: 1 },
    {},
    null
  );

beforeEach(() => jest.clearAllMocks());

describe('publishing a task skill', () => {
  it('needs no schemas once its procedure is written', async () => {
    const doc = skillWith([
      draft({ nature: 'task', procedure: '## Steps\n\n1. Read the report.' }),
    ]);
    LePatronSkills.findOne.mockResolvedValue(doc);

    await publish();

    expect(doc.versions[0].status).toBe('ACTIVE');
    expect(doc.activeVersion).toMatchObject({ major: 1, minor: 1 });
  });

  it.each([
    ['no procedure', {}],
    ['a blank procedure', { procedure: '  \n ' }],
  ])('refuses a version with %s', async (_case, version) => {
    LePatronSkills.findOne.mockResolvedValue(
      skillWith([draft({ nature: 'task', ...version })])
    );

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_PROCEDURE_REQUIRED_TO_PUBLISH',
    });
  });
});

describe('changing the nature of a skill', () => {
  const ACTIVE_FEATURE = {
    versionMajor: 1,
    versionMinor: 0,
    status: 'ACTIVE',
    nature: 'feature',
    inputSchemaId: 'genericTextInput',
    outputSchemaId: 'genericTextOutput',
  };

  it('publishes a task version over a feature one, which keeps its nature', async () => {
    const doc = skillWith(
      [
        ACTIVE_FEATURE,
        draft({ nature: 'task', procedure: '1. Read the report.' }),
      ],
      { major: 1, minor: 0 }
    );
    LePatronSkills.findOne.mockResolvedValue(doc);

    await publish();

    expect(doc.activeVersion).toMatchObject({ major: 1, minor: 1 });
    expect(doc.versions[0]).toMatchObject({
      status: 'ARCHIVED',
      nature: 'feature',
    });
  });

  it('asks a feature version for its schemas, whatever the active one', async () => {
    const doc = skillWith(
      [
        { ...ACTIVE_FEATURE, nature: 'task', procedure: '1. Read.' },
        draft({ nature: 'feature', inputSchemaId: '', outputSchemaId: '' }),
      ],
      { major: 1, minor: 0 }
    );
    LePatronSkills.findOne.mockResolvedValue(doc);

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_SCHEMAS_REQUIRED_TO_PUBLISH',
    });
  });

  it('is never a field of the skill itself', async () => {
    const doc = skillWith([ACTIVE_FEATURE], { major: 1, minor: 0 });
    LePatronSkills.findOne.mockResolvedValue(doc);

    await skillService.updateSkill('qc.read-sending-report', {
      nature: 'task',
    });

    expect(doc).not.toHaveProperty('nature');
  });
});
