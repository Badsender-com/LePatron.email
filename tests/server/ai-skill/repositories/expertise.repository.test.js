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
    it('rejects a call without scope', async () => {
      await expect(
        findApplicable({ categories: ['redaction'] })
      ).rejects.toMatchObject({ status: 400 });
      expect(Expertises.find).not.toHaveBeenCalled();
    });

    it('rejects a call without categories', async () => {
      await expect(findApplicable({ scope: 'cta' })).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        findApplicable({ scope: 'cta', categories: [] })
      ).rejects.toMatchObject({ status: 400 });
      expect(Expertises.find).not.toHaveBeenCalled();
    });

    it('matches on scope intersection OR isTransversal, and on category $in', async () => {
      mockReturnDocs([]);
      await findApplicable({
        scope: ['cta', 'subject'],
        categories: ['redaction'],
      });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and).toEqual([
        { status: 'ACTIVE' },
        {
          $or: [
            { isTransversal: true },
            { scope: { $in: ['cta', 'subject'] } },
          ],
        },
        { category: { $in: ['redaction'] } },
      ]);
    });

    it('wraps a scalar scope into an array', async () => {
      mockReturnDocs([]);
      await findApplicable({ scope: 'cta', categories: ['redaction'] });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and[1]).toEqual({
        $or: [{ isTransversal: true }, { scope: { $in: ['cta'] } }],
      });
    });

    it('an empty-scope non-transversal expertise is NEVER returned', async () => {
      // The Mongo query's $or only matches isTransversal:true OR scope $in;
      // an empty-scope non-transversal doc satisfies neither — Mongo would not
      // return it. Simulate that: the DB returns only the matching docs.
      mockReturnDocs([
        {
          expertiseId: 'transversal',
          isTransversal: true,
          category: 'redaction',
          scope: [],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      const out = await findApplicable({
        scope: 'cta',
        categories: ['redaction'],
      });
      expect(out).toHaveLength(1);
      expect(out[0].expertiseId).toBe('transversal');
      expect(out[0].isTransversal).toBe(true);
    });

    it('keeps the emailType / language fallback clauses', async () => {
      mockReturnDocs([]);
      await findApplicable({
        scope: 'cta',
        categories: ['redaction'],
        emailType: 'promo',
        language: 'fr',
      });
      const query = Expertises.find.mock.calls[0][0];
      // status, scope, category, emailType, language
      expect(query.$and).toHaveLength(5);
      expect(query.$and[3]).toEqual({
        $or: [
          { appliesToEmailTypes: 'promo' },
          { appliesToEmailTypes: { $size: 0 } },
        ],
      });
      expect(query.$and[4]).toEqual({
        $or: [
          { appliesToLanguages: 'fr' },
          { appliesToLanguages: { $size: 0 } },
        ],
      });
    });

    it('drops docs without a matching active version', async () => {
      mockReturnDocs([
        {
          expertiseId: 'a',
          category: 'redaction',
          scope: ['cta'],
          activeVersion: { major: null, minor: 0 },
          versions: [],
        },
        {
          expertiseId: 'b',
          category: 'redaction',
          scope: ['cta'],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      const out = await findApplicable({
        scope: 'cta',
        categories: ['redaction'],
      });
      expect(out).toHaveLength(1);
      expect(out[0].expertiseId).toBe('b');
    });
  });
});
