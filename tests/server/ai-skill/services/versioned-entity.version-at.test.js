/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A draft at a given version number (ADR 0018): an imported skill or expertise
// keeps the number it has on the instance it comes from, so both instances
// speak of the same version. Verified on both entities, as the rest of the
// lifecycle is, on the fake models: they match a write's condition as
// MongoDB does, so two writes at once are seen as they would be.

jest.mock('../../../../packages/server/common/models.common.js', () => ({
  LePatronSkills: {},
  Expertises: {},
}));

const { createMcpStore } = require('../../../helpers/mcp-fake-models');
const {
  createVersionedEntityService,
} = require('../../../../packages/server/ai-skill/services/versioned-entity.service');
const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');

const ENTITIES = [
  {
    label: 'skill',
    collection: 'skills',
    modelName: 'LePatronSkills',
    entityLabel: 'Skill',
    entityNoun: 'skill',
    idField: 'skillId',
    contentFields: skillService.VERSION_CONTENT_FIELDS,
    content: { procedure: '## Steps\n\n1. Imported.' },
  },
  {
    label: 'expertise',
    collection: 'expertises',
    modelName: 'Expertises',
    entityLabel: 'Expertise',
    entityNoun: 'expertise',
    idField: 'expertiseId',
    contentFields: expertiseService.VERSION_CONTENT_FIELDS,
    content: { body: '## Imported\n\nFrom another instance.' },
  },
];

const USER_ID = 'user-1';

describe.each(ENTITIES)('a draft at a given number — $label', (entity) => {
  const store = createMcpStore();
  let service;

  function build({
    versions = [],
    activeVersion = { major: 1, minor: 0 },
    status = 'ACTIVE',
  }) {
    store.seed({
      [entity.collection]: [
        {
          _id: '507f1f77bcf86cd799439950',
          [entity.idField]: 'an-id',
          status,
          activeVersion,
          versions,
        },
      ],
    });
    service = createVersionedEntityService({
      ...entity,
      model: store.models[entity.modelName],
    });
  }

  const stored = () => store.stored(entity.collection)[0];
  const drafts = () => stored().versions.filter((v) => v.status === 'DRAFT');

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

    expect(stored().versions[1]).toMatchObject({
      versionMajor: 2,
      versionMinor: 1,
      status: 'DRAFT',
      changelog: 'Imported',
      createdBy: USER_ID,
      ...entity.content,
    });
    expect(stored().activeVersion).toEqual({ major: 1, minor: 0 });
  });

  it('creates the first version of an item with nothing published', async () => {
    build({ versions: [], activeVersion: { major: null, minor: 0 } });

    await service.createVersionAt('an-id', { major: 2, minor: 1 }, {}, USER_ID);

    expect(stored().versions).toEqual([
      expect.objectContaining({ versionMajor: 2, versionMinor: 1 }),
    ]);
  });

  it('refuses a number at or behind the active version', async () => {
    build({ versions: [active(2, 1)], activeVersion: { major: 2, minor: 1 } });

    await expect(
      service.createVersionAt('an-id', { major: 2, minor: 1 }, {}, USER_ID)
    ).rejects.toMatchObject({
      status: 409,
      message: 'SKILLS_IMPORT_VERSION_NOT_AHEAD',
      id: 'an-id',
      version: '2.1',
    });
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
    ).rejects.toMatchObject({
      status: 409,
      message: 'SKILLS_IMPORT_DRAFT_OPEN',
      version: '2.0',
    });
  });

  it('gives no draft to an archived item', async () => {
    build({ versions: [active(1, 0)], status: 'ARCHIVED' });

    await expect(
      service.createVersionAt('an-id', { major: 2, minor: 0 }, {}, USER_ID)
    ).rejects.toMatchObject({
      status: 409,
      message: 'SKILLS_IMPORT_ARCHIVED',
    });
    expect(drafts()).toEqual([]);
  });

  // Two imports at once, or an import while an assistant starts a draft
  // (ADR 0014): both read the same versions, one draft is written.
  it('opens one draft of two started at once', async () => {
    build({ versions: [active(1, 0)] });

    const results = await Promise.allSettled([
      service.createVersionAt('an-id', { major: 2, minor: 0 }, {}, USER_ID),
      service.createVersionAt('an-id', { major: 2, minor: 0 }, {}, USER_ID),
    ]);

    expect(results.map((result) => result.status).sort()).toEqual([
      'fulfilled',
      'rejected',
    ]);
    expect(results.find((r) => r.status === 'rejected').reason).toMatchObject({
      status: 409,
      message: 'SKILLS_IMPORT_DRAFT_OPEN',
    });
    expect(drafts()).toHaveLength(1);
  });

  it('opens no draft beside one an assistant started meanwhile', async () => {
    build({ versions: [active(1, 0)] });

    const [, imported] = await Promise.allSettled([
      service.openOrStartDraft('an-id', { userId: USER_ID }),
      service.createVersionAt('an-id', { major: 3, minor: 0 }, {}, USER_ID),
    ]);

    expect(imported.reason).toMatchObject({
      status: 409,
      message: 'SKILLS_IMPORT_DRAFT_OPEN',
    });
    expect(drafts()).toEqual([
      expect.objectContaining({ versionMajor: 1, versionMinor: 1 }),
    ]);
  });

  it('leaves the next minor and the next major as they were', async () => {
    build({ versions: [active(1, 0)] });

    await service.createVersionAt('an-id', { major: 3, minor: 0 }, {}, USER_ID);
    store.update(entity.collection, stored()._id, {
      versions: [active(1, 0), { ...stored().versions[1], status: 'ARCHIVED' }],
    });
    await service.createMinorVersion('an-id', USER_ID);

    expect(stored().versions[2]).toMatchObject({
      versionMajor: 1,
      versionMinor: 1,
    });
  });
});
