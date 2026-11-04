'use strict';

// A draft at a given version number (ADR 0018): an imported skill or expertise
// keeps the number it has on the instance it comes from, so both instances
// speak of the same version. Verified on both entities, as the rest of the
// lifecycle is.

jest.mock('../../../../packages/server/common/models.common.js', () => ({
  LePatronSkills: {},
  Expertises: {},
}));

const {
  createVersionedEntityService,
} = require('../../../../packages/server/ai-skill/services/versioned-entity.service');
const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');

const ENTITIES = [
  {
    label: 'skill',
    entityLabel: 'Skill',
    entityNoun: 'skill',
    idField: 'skillId',
    contentFields: skillService.VERSION_CONTENT_FIELDS,
    content: { procedure: '## Steps\n\n1. Imported.' },
  },
  {
    label: 'expertise',
    entityLabel: 'Expertise',
    entityNoun: 'expertise',
    idField: 'expertiseId',
    contentFields: expertiseService.VERSION_CONTENT_FIELDS,
    content: { body: '## Imported\n\nFrom another instance.' },
  },
];

const USER_ID = 'user-1';

describe.each(ENTITIES)('a draft at a given number — $label', (entity) => {
  let doc;
  let service;

  function build({ versions = [], activeVersion = { major: 1, minor: 0 } }) {
    doc = {
      [entity.idField]: 'an-id',
      status: 'ACTIVE',
      activeVersion,
      versions,
      save: jest.fn().mockResolvedValue(undefined),
    };
    const model = { findOne: jest.fn().mockResolvedValue(doc) };
    service = createVersionedEntityService({ ...entity, model });
  }

  const active = (versionMajor, versionMinor) => ({
    versionMajor,
    versionMinor,
    status: 'ACTIVE',
  });

  it('creates a draft at the number given, with the content given', async () => {
    build({ versions: [active(1, 0)] });

    await service.createVersionAt(
      'an-id',
      { major: 2, minor: 1 },
      { ...entity.content, changelog: 'Imported' },
      USER_ID
    );

    expect(doc.versions[1]).toMatchObject({
      versionMajor: 2,
      versionMinor: 1,
      status: 'DRAFT',
      changelog: 'Imported',
      createdBy: USER_ID,
      ...entity.content,
    });
    expect(doc.activeVersion).toEqual({ major: 1, minor: 0 });
    expect(doc.save).toHaveBeenCalled();
  });

  it('creates the first version of an item with nothing published', async () => {
    build({ versions: [], activeVersion: { major: null, minor: 0 } });

    await service.createVersionAt('an-id', { major: 2, minor: 1 }, {}, USER_ID);

    expect(doc.versions).toEqual([
      expect.objectContaining({ versionMajor: 2, versionMinor: 1 }),
    ]);
  });

  it('refuses a number at or behind the active version', async () => {
    build({ versions: [active(2, 1)], activeVersion: { major: 2, minor: 1 } });

    await expect(
      service.createVersionAt('an-id', { major: 2, minor: 1 }, {}, USER_ID)
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.createVersionAt('an-id', { major: 1, minor: 4 }, {}, USER_ID)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('refuses while a draft is open', async () => {
    build({
      versions: [
        active(1, 0),
        { versionMajor: 1, versionMinor: 1, status: 'DRAFT' },
      ],
    });

    await expect(
      service.createVersionAt('an-id', { major: 2, minor: 0 }, {}, USER_ID)
    ).rejects.toMatchObject({ status: 409 });
  });

  it('leaves the next minor and the next major as they were', async () => {
    build({ versions: [active(1, 0)] });

    await service.createVersionAt('an-id', { major: 3, minor: 0 }, {}, USER_ID);
    doc.versions[1].status = 'ARCHIVED';
    await service.createMinorVersion('an-id', USER_ID);

    expect(doc.versions[2]).toMatchObject({ versionMajor: 1, versionMinor: 1 });
  });
});
