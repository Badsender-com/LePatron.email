'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn() },
}));

const {
  findApplicable,
  projectActiveVersion,
} = require('../../../../packages/server/ai-skill/repositories/expertise.repository');
const {
  Expertises,
} = require('../../../../packages/server/common/models.common');

function mockReturnDocs(docs) {
  Expertises.find.mockReturnValue({ lean: () => Promise.resolve(docs) });
}

describe('expertise.repository', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('projectActiveVersion', () => {
    it('returns null when no activeVersion', () => {
      expect(
        projectActiveVersion({ activeVersion: null, versions: [] })
      ).toBeNull();
    });

    it('returns null when activeVersion points to a missing version', () => {
      expect(
        projectActiveVersion({
          activeVersion: 2,
          versions: [{ versionNumber: 1 }],
        })
      ).toBeNull();
    });

    it('projects the matching version', () => {
      const out = projectActiveVersion({
        expertiseId: 'a',
        title: 't',
        category: 'redaction',
        scope: ['cta'],
        activeVersion: 1,
        versions: [
          {
            versionNumber: 1,
            body: 'b',
            examplesGood: ['ok'],
            examplesBad: [],
          },
        ],
      });
      expect(out).toMatchObject({
        expertiseId: 'a',
        versionNumber: 1,
        body: 'b',
        examplesGood: ['ok'],
      });
    });
  });

  describe('findApplicable', () => {
    it('filters by status ACTIVE only by default', async () => {
      mockReturnDocs([]);
      await findApplicable();
      expect(Expertises.find).toHaveBeenCalledWith({ status: 'ACTIVE' });
    });

    it('passes scope as $in when array', async () => {
      mockReturnDocs([]);
      await findApplicable({ scope: ['cta', 'subject'] });
      expect(Expertises.find).toHaveBeenCalledWith({
        status: 'ACTIVE',
        scope: { $in: ['cta', 'subject'] },
      });
    });

    it('passes scope as scalar when string', async () => {
      mockReturnDocs([]);
      await findApplicable({ scope: 'cta', emailType: 'promo' });
      expect(Expertises.find).toHaveBeenCalledWith({
        status: 'ACTIVE',
        scope: 'cta',
        appliesToEmailTypes: 'promo',
      });
    });

    it('uses $or for language to include "all languages" docs', async () => {
      mockReturnDocs([]);
      await findApplicable({ language: 'fr' });
      expect(Expertises.find).toHaveBeenCalledWith({
        status: 'ACTIVE',
        $or: [
          { appliesToLanguages: 'fr' },
          { appliesToLanguages: { $size: 0 } },
        ],
      });
    });

    it('drops docs without a matching active version', async () => {
      mockReturnDocs([
        { expertiseId: 'a', activeVersion: null, versions: [] },
        {
          expertiseId: 'b',
          activeVersion: 1,
          versions: [{ versionNumber: 1, body: 'x' }],
        },
      ]);
      const out = await findApplicable();
      expect(out).toHaveLength(1);
      expect(out[0].expertiseId).toBe('b');
    });
  });
});
