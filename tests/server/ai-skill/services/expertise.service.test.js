'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: {
    find: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
    create: jest.fn(),
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
    activeVersion: null,
    versions: [],
    save: jest.fn().mockImplementation(async function () {
      return this;
    }),
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('expertise.service', () => {
  it('createExpertise throws 409 on duplicate', async () => {
    Expertises.create.mockRejectedValue({ code: 11000 });
    await expect(
      expertiseService.createExpertise(
        { expertiseId: 'a', title: 't', category: 'redaction' },
        null
      )
    ).rejects.toMatchObject({ status: 409 });
  });

  describe('updateVersion', () => {
    it('updates a DRAFT version without requiring a changelog', async () => {
      const doc = mockExpertiseDoc({
        versions: [{ versionNumber: 1, body: 'old' }],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.updateVersion('a', 1, { body: 'new' }, null);
      expect(doc.versions[0].body).toBe('new');
      expect(doc.save).toHaveBeenCalled();
    });

    it('rejects edit on an activated version without changelog', async () => {
      const doc = mockExpertiseDoc({
        versions: [{ versionNumber: 1, activatedAt: new Date() }],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expect(
        expertiseService.updateVersion('a', 1, { body: 'x' }, null)
      ).rejects.toMatchObject({ status: 400 });
    });

    it('accepts edit on an activated version when a changelog is provided', async () => {
      const doc = mockExpertiseDoc({
        versions: [{ versionNumber: 1, body: 'old', activatedAt: new Date() }],
      });
      Expertises.findOne.mockResolvedValue(doc);
      await expertiseService.updateVersion(
        'a',
        1,
        { body: 'new', changelog: 'fix typo' },
        null
      );
      expect(doc.versions[0].body).toBe('new');
      expect(doc.versions[0].changelog).toBe('fix typo');
    });
  });

  it('createVersion increments versionNumber', async () => {
    const doc = mockExpertiseDoc({
      versions: [{ versionNumber: 1 }, { versionNumber: 2 }],
    });
    Expertises.findOne.mockResolvedValue(doc);
    await expertiseService.createVersion('a', { body: '' }, null);
    expect(doc.versions[2].versionNumber).toBe(3);
  });

  it('activateVersion requires changelog and releaseNotes', async () => {
    const doc = mockExpertiseDoc({ versions: [{ versionNumber: 1 }] });
    Expertises.findOne.mockResolvedValue(doc);
    await expect(
      expertiseService.activateVersion('a', 1, {}, null)
    ).rejects.toMatchObject({ status: 400 });
  });

  it('activateVersion flips status and stamps activatedAt', async () => {
    const doc = mockExpertiseDoc({ versions: [{ versionNumber: 1 }] });
    Expertises.findOne.mockResolvedValue(doc);
    await expertiseService.activateVersion(
      'a',
      1,
      { changelog: 'c', releaseNotes: 'r' },
      null
    );
    expect(doc.status).toBe('ACTIVE');
    expect(doc.activeVersion).toBe(1);
  });
});
