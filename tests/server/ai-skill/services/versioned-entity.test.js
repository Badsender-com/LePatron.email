'use strict';

jest.mock('../../../../packages/server/common/models.common.js', () => ({
  LePatronSkills: {},
  Expertises: {},
}));

const {
  createVersionedEntityService,
} = require('../../../../packages/server/ai-skill/services/versioned-entity.service');
const skillService = require('../../../../packages/server/ai-skill/services/skill.service');
const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');

/**
 * The lifecycle contract, verified once against BOTH entities' real content
 * field lists.
 *
 * This is the point of the factory (review A1): the state machine used to be
 * implemented twice, so every versioning fix had to be applied twice — and this
 * PR had already had to port two of them. One test now covers both, and a new
 * content field on either entity is picked up here automatically.
 */
const ENTITIES = [
  {
    label: 'skill',
    entityLabel: 'Skill',
    entityNoun: 'skill',
    idField: 'skillId',
    contentFields: skillService.VERSION_CONTENT_FIELDS,
  },
  {
    label: 'expertise',
    entityLabel: 'Expertise',
    entityNoun: 'expertise',
    idField: 'expertiseId',
    contentFields: expertiseService.VERSION_CONTENT_FIELDS,
  },
];

const USER_ID = 'user-1';

function distinctiveValue(field) {
  if (field.deep) {
    const empty = field.default();
    return Array.isArray(empty)
      ? [{ marker: field.name }]
      : { marker: field.name };
  }
  return `val-${field.name}`;
}

describe.each(ENTITIES)('versioned lifecycle — $label', (entity) => {
  let doc;
  let model;
  let service;

  function makeVersion(overrides = {}) {
    const version = { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' };
    for (const field of entity.contentFields) {
      version[field.name] = distinctiveValue(field);
    }
    return { ...version, ...overrides };
  }

  function build({
    versions = [],
    activeVersion = { major: 1, minor: 0 },
  } = {}) {
    doc = {
      [entity.idField]: 'an-id',
      status: 'DRAFT',
      activeVersion,
      versions,
      save: jest.fn().mockResolvedValue(undefined),
    };
    model = { findOne: jest.fn().mockResolvedValue(doc) };
    service = createVersionedEntityService({ ...entity, model });
  }

  beforeEach(() => build());

  describe('lookup', () => {
    it('looks the document up by its business key', async () => {
      build({ versions: [makeVersion()] });
      await service.getDoc('an-id');
      expect(model.findOne).toHaveBeenCalledWith({ [entity.idField]: 'an-id' });
    });

    it('404s with the entity name when it does not exist', async () => {
      build();
      model.findOne.mockResolvedValue(null);
      await expect(service.getDoc('nope')).rejects.toMatchObject({
        status: 404,
        message: `${entity.entityLabel} "nope" not found`,
      });
    });
  });

  describe('content copy', () => {
    it('blank content covers every declared field', () => {
      const blank = service.blankVersionContent();
      expect(Object.keys(blank).sort()).toEqual(
        entity.contentFields.map((f) => f.name).sort()
      );
    });

    // The bug this guards: a content field added to the model but forgotten in
    // the copy is silently dropped on every new version.
    it('copies every declared field from the source', () => {
      const source = makeVersion();
      const copy = service.cloneVersionContent(source);
      for (const field of entity.contentFields) {
        expect(copy[field.name]).toEqual(source[field.name]);
      }
    });

    it('deep-clones structured fields instead of sharing the reference', () => {
      const source = makeVersion();
      const copy = service.cloneVersionContent(source);
      for (const field of entity.contentFields.filter((f) => f.deep)) {
        expect(copy[field.name]).not.toBe(source[field.name]);
      }
    });

    it('falls back to the empty value for a missing field', () => {
      const source = makeVersion();
      for (const field of entity.contentFields) source[field.name] = undefined;
      const copy = service.cloneVersionContent(source);
      for (const field of entity.contentFields) {
        expect(copy[field.name]).toEqual(field.default());
      }
    });
  });

  describe('createMinorVersion', () => {
    it('increments the minor of the active major and copies its content', async () => {
      const active = makeVersion({ versionMajor: 2, versionMinor: 3 });
      build({ versions: [active], activeVersion: { major: 2, minor: 3 } });

      await service.createMinorVersion('an-id', USER_ID);

      const created = doc.versions[1];
      expect(created.versionMajor).toBe(2);
      expect(created.versionMinor).toBe(4);
      expect(created.status).toBe('DRAFT');
      for (const field of entity.contentFields) {
        expect(created[field.name]).toEqual(active[field.name]);
      }
      expect(doc.save).toHaveBeenCalled();
    });

    it('pre-fills the release notes, so activation does not ask for them', async () => {
      build({ versions: [makeVersion()] });
      await service.createMinorVersion('an-id', USER_ID);
      const created = doc.versions[1];
      expect(created.changelog).toBeTruthy();
      expect(created.releaseNotes).toBeTruthy();
    });

    it('refuses when nothing is published yet', async () => {
      build({
        versions: [makeVersion({ status: 'DRAFT' })],
        activeVersion: {},
      });
      await expect(
        service.createMinorVersion('an-id', USER_ID)
      ).rejects.toThrow(
        new RegExp(`no active version on this ${entity.entityNoun}`)
      );
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('createMajorVersion', () => {
    it('takes the next major and seeds from the active version', async () => {
      const active = makeVersion({ versionMajor: 3 });
      build({ versions: [active], activeVersion: { major: 3, minor: 0 } });

      await service.createMajorVersion('an-id', { userId: USER_ID });

      const created = doc.versions[1];
      expect(created.versionMajor).toBe(4);
      expect(created.versionMinor).toBe(0);
      for (const field of entity.contentFields) {
        expect(created[field.name]).toEqual(active[field.name]);
      }
    });

    it('seeds from an explicit source (the duplicate flow)', async () => {
      const other = makeVersion({ versionMajor: 1 });
      build({
        versions: [makeVersion({ versionMajor: 5 })],
        activeVersion: { major: 5, minor: 0 },
      });
      await service.createMajorVersion('an-id', {
        source: other,
        userId: USER_ID,
      });
      const created = doc.versions[1];
      expect(created.versionMajor).toBe(6);
      for (const field of entity.contentFields) {
        expect(created[field.name]).toEqual(other[field.name]);
      }
    });

    it('starts blank when nothing is published and no source is given', async () => {
      build({ versions: [], activeVersion: {} });
      await service.createMajorVersion('an-id', { userId: USER_ID });
      const created = doc.versions[0];
      expect(created.versionMajor).toBe(1);
      for (const field of entity.contentFields) {
        expect(created[field.name]).toEqual(field.default());
      }
    });

    // Left empty on purpose: the activation gate demands both for a major.
    it('leaves the release notes empty', async () => {
      build({ versions: [], activeVersion: {} });
      await service.createMajorVersion('an-id', { userId: USER_ID });
      expect(doc.versions[0].changelog).toBe('');
      expect(doc.versions[0].releaseNotes).toBe('');
    });
  });

  // The assistant's way to a draft (ADR 0014): one draft open at a time.
  describe('openOrStartDraft', () => {
    const active = () => makeVersion({ versionMajor: 2, versionMinor: 0 });

    it('starts a minor draft on the condition that the versions did not change', async () => {
      build({ versions: [active()], activeVersion: { major: 2, minor: 0 } });
      model.findOneAndUpdate = jest.fn(async (_filter, { $push }) => ({
        ...doc,
        versions: [...doc.versions, $push.versions],
      }));

      const { version } = await service.openOrStartDraft('an-id', {
        userId: USER_ID,
      });

      expect(version).toMatchObject({ versionMajor: 2, versionMinor: 1 });
      expect(model.findOneAndUpdate).toHaveBeenCalledWith(
        {
          [entity.idField]: 'an-id',
          status: { $ne: 'ARCHIVED' },
          versions: { $size: 1 },
        },
        { $push: { versions: expect.objectContaining({ status: 'DRAFT' }) } },
        { new: true }
      );
    });

    it('writes nothing when a draft is open', async () => {
      build({
        versions: [active(), makeVersion({ versionMinor: 1, status: 'DRAFT' })],
        activeVersion: { major: 2, minor: 0 },
      });
      doc.versions[1].versionMajor = 2;
      model.findOneAndUpdate = jest.fn();

      const { version } = await service.openOrStartDraft('an-id');

      expect(version).toMatchObject({ versionMajor: 2, versionMinor: 1 });
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });

    it('refuses when the document changed and leaves no draft to write', async () => {
      build({ versions: [active()], activeVersion: { major: 2, minor: 0 } });
      model.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      await expect(service.openOrStartDraft('an-id')).rejects.toMatchObject({
        status: 409,
      });
      expect(model.findOne).toHaveBeenCalledTimes(2);
    });
  });

  // An assistant's change is written on the condition that the draft it read
  // was not written since: its update date.
  describe('writeDraftIfUnchanged', () => {
    const READ_AT = new Date('2026-11-01T10:00:00Z');
    const readDraft = () =>
      makeVersion({ versionMinor: 1, status: 'DRAFT', updatedAt: READ_AT });

    beforeEach(() => {
      build({ versions: [makeVersion(), readDraft()] });
      doc.validate = jest.fn().mockResolvedValue(undefined);
    });

    it('validates, then writes the draft only if its update date is the one read', async () => {
      model.findOneAndUpdate = jest.fn().mockResolvedValue(doc);
      const [, version] = doc.versions;

      await service.writeDraftIfUnchanged(
        doc,
        version,
        { changelog: 'Shorter' },
        USER_ID
      );

      expect(doc.validate).toHaveBeenCalled();
      const [filter, update] = model.findOneAndUpdate.mock.calls[0];
      expect(filter.versions.$elemMatch).toEqual({
        versionMajor: 1,
        versionMinor: 1,
        status: 'DRAFT',
        updatedAt: READ_AT,
      });
      expect(update.$set['versions.$']).toMatchObject({ changelog: 'Shorter' });
      expect(update.$set['versions.$'].updatedAt.getTime()).toBeGreaterThan(
        READ_AT.getTime()
      );
    });

    it('refuses when the draft changed since it was read', async () => {
      model.findOneAndUpdate = jest.fn().mockResolvedValue(null);

      await expect(
        service.writeDraftIfUnchanged(doc, doc.versions[1], {}, USER_ID)
      ).rejects.toMatchObject({
        status: 409,
        message: expect.stringMatching(/changed since it was read/),
      });
    });

    it('writes nothing the schema refuses', async () => {
      model.findOneAndUpdate = jest.fn();
      doc.validate.mockRejectedValue(
        Object.assign(new Error('bad section'), { status: 400 })
      );

      await expect(
        service.writeDraftIfUnchanged(doc, doc.versions[1], {}, USER_ID)
      ).rejects.toMatchObject({ status: 400 });
      expect(model.findOneAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('updateVersion', () => {
    it('patches content fields plus the release notes', async () => {
      build({ versions: [makeVersion({ status: 'DRAFT' })] });
      const patch = { changelog: 'why', releaseNotes: 'what' };
      for (const field of entity.contentFields) {
        patch[field.name] = distinctiveValue({
          ...field,
          name: `${field.name}-new`,
        });
      }

      await service.updateVersion(
        'an-id',
        { major: 1, minor: 0 },
        patch,
        USER_ID
      );

      const version = doc.versions[0];
      for (const field of entity.contentFields) {
        expect(version[field.name]).toEqual(patch[field.name]);
      }
      expect(version.changelog).toBe('why');
      expect(version.updatedBy).toBe(USER_ID);
    });

    it('ignores keys that are not patchable', async () => {
      build({ versions: [makeVersion({ status: 'DRAFT' })] });
      await service.updateVersion(
        'an-id',
        { major: 1, minor: 0 },
        { status: 'ACTIVE', versionMajor: 99, activatedAt: new Date() },
        USER_ID
      );
      expect(doc.versions[0].status).toBe('DRAFT');
      expect(doc.versions[0].versionMajor).toBe(1);
    });

    it('refuses to touch a published version', async () => {
      build({ versions: [makeVersion({ status: 'ACTIVE' })] });
      await expect(
        service.updateVersion('an-id', { major: 1, minor: 0 }, {}, USER_ID)
      ).rejects.toMatchObject({ status: 409 });
    });
  });

  describe('deleteVersion', () => {
    it('removes a draft', async () => {
      build({
        versions: [
          makeVersion({ status: 'ACTIVE' }),
          makeVersion({ versionMinor: 1, status: 'DRAFT' }),
        ],
      });
      await service.deleteVersion('an-id', { major: 1, minor: 1 });
      expect(doc.versions).toHaveLength(1);
      expect(doc.versions[0].versionMinor).toBe(0);
    });

    it('refuses to remove a published version', async () => {
      build({ versions: [makeVersion({ status: 'ACTIVE' })] });
      await expect(
        service.deleteVersion('an-id', { major: 1, minor: 0 })
      ).rejects.toMatchObject({ status: 409 });
      expect(doc.versions).toHaveLength(1);
    });
  });

  describe('activateVersion', () => {
    const notes = { changelog: 'c', releaseNotes: 'r' };

    it('publishes the draft, archives the one it replaces, moves the pointer', async () => {
      build({
        versions: [
          makeVersion({ versionMajor: 1, status: 'ACTIVE' }),
          makeVersion({ versionMajor: 2, versionMinor: 0, status: 'DRAFT' }),
        ],
        activeVersion: { major: 1, minor: 0 },
      });

      await service.activateVersion(
        'an-id',
        { major: 2, minor: 0 },
        notes,
        USER_ID
      );

      expect(doc.versions[0].status).toBe('ARCHIVED');
      expect(doc.versions[1].status).toBe('ACTIVE');
      expect(doc.versions[1].activatedAt).toBeInstanceOf(Date);
      expect(doc.activeVersion).toEqual({ major: 2, minor: 0 });
      expect(doc.status).toBe('ACTIVE');
    });

    it('demands release notes for a major', async () => {
      build({
        versions: [makeVersion({ status: 'DRAFT' })],
        activeVersion: {},
      });
      await expect(
        service.activateVersion('an-id', { major: 1, minor: 0 }, {}, USER_ID)
      ).rejects.toThrow(/changelog and releaseNotes are required/);
    });

    it('does not demand them for a minor', async () => {
      build({
        versions: [
          makeVersion({
            versionMinor: 2,
            status: 'DRAFT',
            changelog: 'auto',
            releaseNotes: 'auto',
          }),
        ],
        activeVersion: {},
      });
      await service.activateVersion(
        'an-id',
        { major: 1, minor: 2 },
        {},
        USER_ID
      );
      expect(doc.versions[0].status).toBe('ACTIVE');
    });

    it('404s on an unknown version and 409s on one already published', async () => {
      build({ versions: [makeVersion({ status: 'ACTIVE' })] });
      await expect(
        service.activateVersion('an-id', { major: 9, minor: 9 }, notes, USER_ID)
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        service.activateVersion('an-id', { major: 1, minor: 0 }, notes, USER_ID)
      ).rejects.toMatchObject({ status: 409 });
    });

    it('runs the injected gate before publishing anything', async () => {
      build({
        versions: [makeVersion({ status: 'DRAFT' })],
        activeVersion: {},
      });
      const gate = jest.fn(() => {
        throw new Error('refused by the gate');
      });
      service = createVersionedEntityService({
        ...entity,
        model,
        activationGate: gate,
      });

      await expect(
        service.activateVersion('an-id', { major: 1, minor: 0 }, notes, USER_ID)
      ).rejects.toThrow('refused by the gate');
      expect(gate).toHaveBeenCalledWith(doc.versions[0], doc);
      expect(doc.versions[0].status).toBe('DRAFT');
      expect(doc.save).not.toHaveBeenCalled();
    });
  });

  describe('archive', () => {
    it('archives the document itself, leaving its versions alone', async () => {
      build({ versions: [makeVersion({ status: 'ACTIVE' })] });
      await service.archive('an-id');
      expect(doc.status).toBe('ARCHIVED');
      expect(doc.versions[0].status).toBe('ACTIVE');
      expect(doc.save).toHaveBeenCalled();
    });
  });
});
