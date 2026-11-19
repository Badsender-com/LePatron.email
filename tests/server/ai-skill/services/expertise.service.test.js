'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
    distinct: jest.fn(),
  },
}));

const expertiseService = require('../../../../packages/server/ai-skill/services/expertise.service');
const {
  Expertises,
} = require('../../../../packages/server/common/models.common');

function mockExpertiseDoc(overrides = {}) {
  return {
    expertiseId: 'a',
    status: 'DRAFT',
    activeVersion: { major: null, minor: 0 },
    versions: [],
    save: jest.fn().mockImplementation(async function () {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('expertise.service', () => {
  it('getFacets returns sorted, non-null distinct scopes and emailTypes', async () => {
    Expertises.distinct.mockImplementation((field) =>
      Promise.resolve(
        field === 'scope'
          ? ['subject', null, 'cta']
          : [null, 'promo', 'newsletter']
      )
    );
    const facets = await expertiseService.getFacets();
    expect(facets.scopes).toEqual(['cta', 'subject']);
    expect(facets.emailTypes).toEqual(['newsletter', 'promo']);
  });

  it('createExpertise throws 409 on duplicate', async () => {
    Expertises.create.mockRejectedValue({ code: 11000 });
    await expect(
      expertiseService.createExpertise(
        { expertiseId: 'a', title: 't', category: 'redaction' },
        null
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  it('createExpertise persists isTransversal', async () => {
    Expertises.create.mockResolvedValue({});
    await expertiseService.createExpertise(
      {
        expertiseId: 'a',
        title: 't',
        category: 'redaction',
        isTransversal: true,
      },
      null
    );
    expect(Expertises.create.mock.calls[0][0].isTransversal).toBe(true);
  });

  it('createExpertise defaults isTransversal to false', async () => {
    Expertises.create.mockResolvedValue({});
    await expertiseService.createExpertise(
      { expertiseId: 'a', title: 't', category: 'redaction' },
      null
    );
    expect(Expertises.create.mock.calls[0][0].isTransversal).toBe(false);
  });

  // Opening to every company is an act of its own (ADR 0013), never a field
  // of the creation.
  it('createExpertise starts with the platform company, whatever the request says', async () => {
    Expertises.create.mockResolvedValue({});
    await expertiseService.createExpertise(
      { expertiseId: 'a', title: 't', category: 'redaction', audience: 'all' },
      null
    );
    expect(Expertises.create.mock.calls[0][0].audience).toBe('platform');
  });

  it('createExpertise seeds a v1.0 DRAFT (empty content) — §4', async () => {
    Expertises.create.mockResolvedValue({});
    await expertiseService.createExpertise(
      { expertiseId: 'a', title: 't', category: 'redaction' },
      null
    );
    const { versions } = Expertises.create.mock.calls[0][0];
    expect(versions).toHaveLength(1);
    expect(versions[0].versionMajor).toBe(1);
    expect(versions[0].versionMinor).toBe(0);
    expect(versions[0].status).toBe('DRAFT');
    expect(versions[0].body).toBe('');
  });

  it('updateExpertise patches isTransversal', async () => {
    const doc = mockExpertiseDoc({ isTransversal: false });
    Expertises.findOne.mockResolvedValue(doc);
    await expertiseService.updateExpertise('a', { isTransversal: true });
    expect(doc.isTransversal).toBe(true);
    expect(doc.save).toHaveBeenCalled();
  });

  // What the publication's confirmation sends to open an expertise to every
  // company (ADR 0013).
  it('updateExpertise patches the audience', async () => {
    const doc = mockExpertiseDoc({ audience: 'platform' });
    Expertises.findOne.mockResolvedValue(doc);

    await expertiseService.updateExpertise('a', { audience: 'all' });

    expect(doc.audience).toBe('all');
    expect(doc.save).toHaveBeenCalled();
  });

  // An assistant's change of audience, applied on the item as it checked it
  // (ADR 0014): a write made meanwhile is never written over.
  it('updateExpertise writes on the condition that the item is as read', async () => {
    const readAt = new Date('2026-11-10T09:00:00.000Z');
    let condition;
    const doc = mockExpertiseDoc({
      audience: 'platform',
      updatedAt: readAt,
      save: jest.fn().mockImplementation(async function () {
        condition = this.$where;
        throw Object.assign(new Error('No document found'), {
          name: 'DocumentNotFoundError',
        });
      }),
    });
    Expertises.findOne.mockResolvedValue(doc);

    await expect(
      expertiseService.updateExpertise('a', { audience: 'all' }, { readAt })
    ).rejects.toMatchObject({ status: 409, message: 'SKILL_ITEM_CHANGED' });
    expect(condition).toEqual({ updatedAt: readAt });
    expect(doc.$where).toBeUndefined();
  });

  it('updateExpertise marks the item written, later than it was read', async () => {
    const readAt = new Date('2026-11-10T09:00:00.000Z');
    const doc = mockExpertiseDoc({ audience: 'platform', updatedAt: readAt });
    Expertises.findOne.mockResolvedValue(doc);

    await expertiseService.updateExpertise(
      'a',
      { audience: 'all' },
      { readAt }
    );

    expect(doc.updatedAt.getTime()).toBeGreaterThan(readAt.getTime());
    expect(doc.save).toHaveBeenCalled();
  });

  // On a copy, what an assistant changes there stays there (ADR 0019).
  it('updateExpertise keeps the item on a copy in the same write', async () => {
    const doc = mockExpertiseDoc({ audience: 'platform' });
    Expertises.findOne.mockResolvedValue(doc);

    await expertiseService.updateExpertise(
      'a',
      { audience: 'all' },
      { keepOnCopy: true, userId: 'alice' }
    );

    expect(doc).toMatchObject({
      audience: 'all',
      keptOnCopy: true,
      keptOnCopyAt: expect.any(Date),
      _keptOnCopyBy: 'alice',
    });
    expect(doc.save).toHaveBeenCalledTimes(1);
  });

  describe('getActivationImpact', () => {
    it('throws 404 when the expertise is missing', async () => {
      Expertises.findOne.mockResolvedValue(null);
      await expect(
        expertiseService.getActivationImpact('missing')
      ).rejects.toMatchObject({ status: 404 });
    });

    it('returns an array of manifest matches', async () => {
      Expertises.findOne.mockResolvedValue(
        mockExpertiseDoc({
          category: 'redaction',
          scope: ['cta'],
          isTransversal: false,
          appliesToEmailTypes: [],
        })
      );
      const out = await expertiseService.getActivationImpact('a');
      expect(Array.isArray(out)).toBe(true);
    });
  });

  describe('createMajorVersion', () => {
    it('starts at 1.0 when there is no version', async () => {
      const doc = mockExpertiseDoc();
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.createMajorVersion('a', { userId: null });
      expect(doc.versions[0].versionMajor).toBe(1);
      expect(doc.versions[0].versionMinor).toBe(0);
      expect(doc.versions[0].status).toBe('DRAFT');
    });

    it('bumps major and clones the active version content', async () => {
      const doc = mockExpertiseDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ACTIVE',
            body: 'active body',
            examplesGood: ['ok'],
            examplesBad: [],
          },
        ],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.createMajorVersion('a', { userId: null });
      const created = doc.versions[doc.versions.length - 1];
      expect(created.versionMajor).toBe(2);
      expect(created.versionMinor).toBe(0);
      expect(created.body).toBe('active body');
      expect(created.examplesGood).toEqual(['ok']);
    });
  });

  describe('createMinorVersion', () => {
    it('refuses when there is no active version', async () => {
      const doc = mockExpertiseDoc();
      Expertises.findOne.mockResolvedValue(doc);
      await expect(
        expertiseService.createMinorVersion('a', null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('increments minor and pre-fills the changelog', async () => {
      const doc = mockExpertiseDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'ACTIVE',
            body: 'body',
          },
        ],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.createMinorVersion('a', null);
      const created = doc.versions[doc.versions.length - 1];
      expect(created.versionMajor).toBe(1);
      expect(created.versionMinor).toBe(1);
      expect(created.changelog).toBe('Correction mineure');
    });
  });

  describe('updateVersion', () => {
    it('rejects edit on ACTIVE/ARCHIVED', async () => {
      const doc = mockExpertiseDoc({
        versions: [{ versionMajor: 1, versionMinor: 0, status: 'ACTIVE' }],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expect(
        expertiseService.updateVersion(
          'a',
          { major: 1, minor: 0 },
          { body: 'x' },
          null
        )
      ).rejects.toMatchObject({ status: 409 });
    });

    it('updates DRAFT fields', async () => {
      const doc = mockExpertiseDoc({
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            status: 'DRAFT',
            body: 'old',
          },
        ],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.updateVersion(
        'a',
        { major: 1, minor: 0 },
        { body: 'new' },
        null
      );
      expect(doc.versions[0].body).toBe('new');
    });
  });

  describe('activateVersion', () => {
    it('requires changelog + releaseNotes for major', async () => {
      const doc = mockExpertiseDoc({
        versions: [{ versionMajor: 1, versionMinor: 0, status: 'DRAFT' }],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expect(
        expertiseService.activateVersion('a', { major: 1, minor: 0 }, {}, null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('archives the previously active version on activation', async () => {
      const doc = mockExpertiseDoc({
        activeVersion: { major: 1, minor: 0 },
        versions: [
          { versionMajor: 1, versionMinor: 0, status: 'ACTIVE' },
          {
            versionMajor: 1,
            versionMinor: 1,
            status: 'DRAFT',
            changelog: 'fix',
            releaseNotes: 'fix',
          },
        ],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.activateVersion(
        'a',
        { major: 1, minor: 1 },
        {},
        null
      );
      expect(doc.versions[0].status).toBe('ARCHIVED');
      expect(doc.versions[1].status).toBe('ACTIVE');
      expect(doc.activeVersion).toEqual({ major: 1, minor: 1 });
    });
  });
});
