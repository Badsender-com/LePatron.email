'use strict';

// Publishing a task skill (ADR 0013): it has neither template nor schemas, so
// the schemas a feature skill needs are not asked of it; its procedure is.

jest.mock('../../../../packages/server/common/models.common', () => ({
  LePatronSkills: { findOne: jest.fn() },
}));

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const {
  LePatronSkills,
} = require('../../../../packages/server/common/models.common');

function taskSkill(version) {
  return {
    skillId: 'qc.read-sending-report',
    nature: 'task',
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
    versions: [
      { versionMajor: 1, versionMinor: 1, status: 'DRAFT', ...version },
    ],
    save: jest.fn().mockImplementation(async function save() {
      return this;
    }),
  };
}

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
    const doc = taskSkill({ procedure: '## Steps\n\n1. Read the report.' });
    LePatronSkills.findOne.mockResolvedValue(doc);

    await publish();

    expect(doc.versions[0].status).toBe('ACTIVE');
    expect(doc.activeVersion).toMatchObject({ major: 1, minor: 1 });
  });

  it.each([
    ['no procedure', {}],
    ['a blank procedure', { procedure: '  \n ' }],
  ])('refuses a version with %s', async (_case, version) => {
    LePatronSkills.findOne.mockResolvedValue(taskSkill(version));

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_PROCEDURE_REQUIRED_TO_PUBLISH',
    });
  });
});
