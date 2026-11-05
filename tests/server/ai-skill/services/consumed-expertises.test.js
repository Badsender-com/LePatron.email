'use strict';

// The expertises a task skill's version consumes (ADR 0013), checked when a
// draft is saved and when it is published: a list of at most twenty
// expertise ids, each named once and naming an expertise that exists. The MCP
// adapter then serves the published ones, in the order of the list. What a
// publication warns of is in consumed-expertise-warnings.test.js.

jest.mock('../../../../packages/server/common/models.common', () => ({
  LePatronSkills: { findOne: jest.fn() },
  Expertises: { find: jest.fn() },
}));

const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const {
  LePatronSkills,
  Expertises,
} = require('../../../../packages/server/common/models.common');

const SKILL_ID = 'qc.read-sending-report';
const KNOWN = ['qc.deliverability', 'qc.subject-line', 'brand.tone'];

function skillWith(version) {
  const doc = {
    skillId: SKILL_ID,
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
    versions: [
      {
        versionMajor: 1,
        versionMinor: 1,
        status: 'DRAFT',
        nature: 'task',
        procedure: '1. Read the report.',
        consumedExpertiseIds: [],
        ...version,
      },
    ],
    save: jest.fn().mockImplementation(async function save() {
      return this;
    }),
  };
  LePatronSkills.findOne.mockResolvedValue(doc);
  return doc;
}

const ids = (count) =>
  Array.from({ length: count }, (_, i) => `qc.expertise-${i}`);

const save = (consumedExpertiseIds) =>
  skillService.updateVersion(
    SKILL_ID,
    { major: 1, minor: 1 },
    { consumedExpertiseIds },
    null
  );

const publish = () =>
  skillService.activateVersion(SKILL_ID, { major: 1, minor: 1 }, {}, null);

beforeEach(() => {
  jest.clearAllMocks();
  // Answers the expertises asked for that exist: KNOWN and every
  // `qc.expertise-N`.
  Expertises.find.mockImplementation((query) => ({
    lean: jest
      .fn()
      .mockResolvedValue(
        query.expertiseId.$in
          .filter((id) => KNOWN.includes(id) || id.startsWith('qc.expertise-'))
          .map((expertiseId) => ({ expertiseId }))
      ),
  }));
});

describe('saving the expertises a draft consumes', () => {
  it('keeps the ids, in their order, when each names an expertise', async () => {
    const doc = skillWith();

    await save(['brand.tone', 'qc.deliverability']);

    expect(doc.versions[0].consumedExpertiseIds).toEqual([
      'brand.tone',
      'qc.deliverability',
    ]);
    expect(doc.save).toHaveBeenCalled();
  });

  it('reads the expertises at once', async () => {
    skillWith();

    await save(['brand.tone', 'qc.deliverability']);

    expect(Expertises.find).toHaveBeenCalledTimes(1);
    expect(Expertises.find.mock.calls[0][0]).toEqual({
      expertiseId: { $in: ['brand.tone', 'qc.deliverability'] },
    });
  });

  it('refuses an expertise named twice, names it, and reads nothing', async () => {
    const doc = skillWith();

    await expect(
      save(['brand.tone', 'qc.deliverability', 'brand.tone'])
    ).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_DUPLICATED',
      expertiseIds: ['brand.tone'],
    });
    expect(Expertises.find).not.toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('takes an empty list without reading anything', async () => {
    const doc = skillWith({ consumedExpertiseIds: ['brand.tone'] });

    await save([]);

    expect(doc.versions[0].consumedExpertiseIds).toEqual([]);
    expect(Expertises.find).not.toHaveBeenCalled();
  });

  it('leaves them alone when the draft is saved without them', async () => {
    const doc = skillWith({ consumedExpertiseIds: ['brand.tone'] });

    await skillService.updateVersion(
      SKILL_ID,
      { major: 1, minor: 1 },
      { procedure: '1. Read it again.' },
      null
    );

    expect(doc.versions[0].consumedExpertiseIds).toEqual(['brand.tone']);
    expect(Expertises.find).not.toHaveBeenCalled();
  });

  it.each([
    ['a string', 'brand.tone'],
    ['an object', { $ne: null }],
    ['an id with capitals', ['Brand.Tone']],
    ['an id with a space', ['brand tone']],
    ['an empty id', ['']],
    ['an id too long', ['x'.repeat(101)]],
    ['an object in the list', [{ $gt: '' }]],
  ])('refuses %s, and writes nothing', async (_case, value) => {
    const doc = skillWith();

    await expect(save(value)).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_INVALID',
    });
    expect(doc.save).not.toHaveBeenCalled();
    expect(Expertises.find).not.toHaveBeenCalled();
  });

  it('takes twenty expertises', async () => {
    const doc = skillWith();

    await save(ids(20));

    expect(doc.versions[0].consumedExpertiseIds).toHaveLength(20);
  });

  it('refuses a twenty-first, before reading any', async () => {
    const doc = skillWith();

    await expect(save(ids(21))).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_TOO_MANY',
      max: 20,
    });
    expect(Expertises.find).not.toHaveBeenCalled();
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('refuses an expertise that does not exist, and names it', async () => {
    const doc = skillWith();

    await expect(
      save(['brand.tone', 'qc.gone', 'qc.never-was'])
    ).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_NOT_FOUND',
      expertiseIds: ['qc.gone', 'qc.never-was'],
    });
    expect(doc.save).not.toHaveBeenCalled();
  });
});

describe('publishing a draft that consumes expertises', () => {
  it('publishes when each names an expertise', async () => {
    const doc = skillWith({ consumedExpertiseIds: KNOWN });

    await publish();

    expect(doc.versions[0].status).toBe('ACTIVE');
  });

  it('refuses one that names an expertise that does not exist', async () => {
    const doc = skillWith({ consumedExpertiseIds: ['brand.tone', 'qc.gone'] });

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_NOT_FOUND',
      expertiseIds: ['qc.gone'],
    });
    expect(doc.versions[0].status).toBe('DRAFT');
    expect(doc.save).not.toHaveBeenCalled();
  });

  it('refuses one that consumes more than twenty', async () => {
    skillWith({ consumedExpertiseIds: ids(21) });

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_TOO_MANY',
    });
  });

  it('refuses one that names an expertise twice', async () => {
    const doc = skillWith({
      consumedExpertiseIds: ['brand.tone', 'brand.tone'],
    });

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_DUPLICATED',
    });
    expect(doc.versions[0].status).toBe('DRAFT');
  });

  it('refuses one stored with an id that is not one', async () => {
    skillWith({ consumedExpertiseIds: ['Not An Id'] });

    await expect(publish()).rejects.toMatchObject({
      status: 400,
      message: 'SKILL_CONSUMED_EXPERTISES_INVALID',
    });
  });
});
