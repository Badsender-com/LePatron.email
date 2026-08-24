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
