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
        projectActiveVersion({
          activeVersion: { major: null, minor: 0 },
          versions: [],
        })
      ).toBeNull();
    });

    it('returns null when activeVersion points to a missing version', () => {
      expect(
        projectActiveVersion({
          activeVersion: { major: 2, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0 }],
        })
      ).toBeNull();
    });

    it('projects the matching version', () => {
      const out = projectActiveVersion({
        expertiseId: 'a',
        title: 't',
        category: 'redaction',
        scope: ['cta'],
        activeVersion: { major: 1, minor: 0 },
        versions: [
          {
            versionMajor: 1,
            versionMinor: 0,
            body: 'b',
            examplesGood: ['ok'],
            examplesBad: [],
          },
        ],
      });
      expect(out).toMatchObject({
        expertiseId: 'a',
        versionMajor: 1,
        versionMinor: 0,
        body: 'b',
        examplesGood: ['ok'],
      });
    });
  });

  describe('findApplicable', () => {
    it('filters by status ACTIVE only when no filter is provided', async () => {
      mockReturnDocs([]);
      await findApplicable();
      expect(Expertises.find).toHaveBeenCalledWith({ status: 'ACTIVE' });
    });

    it('builds an $and with $or fallback to empty array for scope', async () => {
      mockReturnDocs([]);
      await findApplicable({ scope: ['cta', 'subject'] });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and).toEqual([
        { status: 'ACTIVE' },
        {
          $or: [
            { scope: { $in: ['cta', 'subject'] } },
            { scope: { $size: 0 } },
          ],
        },
      ]);
    });

    it('wraps a scalar scope into the same $or pattern', async () => {
      mockReturnDocs([]);
      await findApplicable({ scope: 'cta', emailType: 'promo' });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and).toEqual([
        { status: 'ACTIVE' },
        {
          $or: [{ scope: { $in: ['cta'] } }, { scope: { $size: 0 } }],
        },
        {
          $or: [
            { appliesToEmailTypes: 'promo' },
            { appliesToEmailTypes: { $size: 0 } },
          ],
        },
      ]);
    });

    it('combines all 3 multi-valued filters with $and', async () => {
      mockReturnDocs([]);
      await findApplicable({
        scope: 'cta',
        emailType: 'promo',
        language: 'fr',
      });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and).toHaveLength(4);
    });

    it('drops docs without a matching active version', async () => {
      mockReturnDocs([
        {
          expertiseId: 'a',
          activeVersion: { major: null, minor: 0 },
          versions: [],
        },
        {
          expertiseId: 'b',
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      const out = await findApplicable();
      expect(out).toHaveLength(1);
      expect(out[0].expertiseId).toBe('b');
    });
  });
});
