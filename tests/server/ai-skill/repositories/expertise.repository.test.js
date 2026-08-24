'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn(), distinct: jest.fn() },
}));

jest.mock('../../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  findApplicable,
  projectActiveVersion,
} = require('../../../../packages/server/ai-skill/repositories/expertise.repository');
const {
  Expertises,
} = require('../../../../packages/server/common/models.common');
const logger = require('../../../../packages/server/utils/logger.js');

// The warning is fire-and-forget (it must not add a round-trip to the hot
// path), so let the microtask queue drain before asserting on it.
function flushWarning() {
  return new Promise((resolve) => setImmediate(resolve));
}

function mockReturnDocs(docs) {
  Expertises.find.mockReturnValue({ lean: () => Promise.resolve(docs) });
  Expertises.distinct.mockResolvedValue(
    docs.flatMap((d) => d.scope || []).filter(Boolean)
  );
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

    it('returns a deterministic order: transversal first, then expertiseId alpha', async () => {
      // DB order is intentionally shuffled — the repository must reorder.
      const mk = (expertiseId, isTransversal) => ({
        expertiseId,
        isTransversal,
        category: 'redaction',
        scope: ['cta'],
        activeVersion: { major: 1, minor: 0 },
        versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
      });
      mockReturnDocs([
        mk('redaction.cta.zebra', false),
        mk('redaction.brand-voice', true),
        mk('redaction.cta.alpha', false),
        mk('redaction.tone', true),
      ]);
      const out = await findApplicable({
        scope: 'cta',
        categories: ['redaction'],
      });
      expect(out.map((e) => e.expertiseId)).toEqual([
        'redaction.brand-voice', // transversal, alpha
        'redaction.tone', // transversal, alpha
        'redaction.cta.alpha', // scoped, alpha
        'redaction.cta.zebra', // scoped, alpha
      ]);
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

  describe('scope normalisation and unmatched-scope warning (R2)', () => {
    it('normalises the requested scope, so UI casing meets code casing', async () => {
      mockReturnDocs([]);
      await findApplicable({
        scope: [' CTA ', 'Objet'],
        categories: ['redaction'],
      });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and[1]).toEqual({
        $or: [{ isTransversal: true }, { scope: { $in: ['cta', 'objet'] } }],
      });
    });

    it('dedupes scopes that collapse once normalised', async () => {
      mockReturnDocs([]);
      await findApplicable({
        scope: ['CTA', 'cta'],
        categories: ['redaction'],
      });
      const query = Expertises.find.mock.calls[0][0];
      expect(query.$and[1].$or[1]).toEqual({ scope: { $in: ['cta'] } });
    });

    it('stays silent when every requested scope matched something', async () => {
      mockReturnDocs([
        {
          expertiseId: 'cta-principles',
          category: 'redaction',
          scope: ['cta'],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      await findApplicable({ scope: 'cta', categories: ['redaction'] });
      await flushWarning();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    /**
     * The silent failure of R2: the caller asks for a scope no expertise
     * carries, so nothing from it reaches the prompt — and the invocation
     * succeeds anyway.
     */
    it('warns when a requested scope matched no expertise', async () => {
      mockReturnDocs([]);
      Expertises.distinct.mockResolvedValue(['cta', 'objet']);
      await findApplicable({ scope: 'bouton', categories: ['redaction'] });
      await flushWarning();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      const message = logger.warn.mock.calls[0][0];
      expect(message).toContain('bouton');
      // The scopes that DO exist are the one thing needed to fix the call.
      expect(message).toContain('cta');
      expect(message).toContain('objet');
    });

    /**
     * The nastiest shape: transversal expertises match whatever the scope, so
     * the returned list is NOT empty. The prompt is not broken, just poorer —
     * which is exactly what goes unnoticed without this warning.
     */
    it('warns even when transversal expertises came back', async () => {
      mockReturnDocs([
        {
          expertiseId: 'general',
          isTransversal: true,
          category: 'redaction',
          scope: [],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      Expertises.distinct.mockResolvedValue(['cta']);
      const out = await findApplicable({
        scope: 'bouton',
        categories: ['redaction'],
      });
      expect(out).toHaveLength(1);
      await flushWarning();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain('bouton');
    });

    /**
     * The false negative: the schema tolerates isTransversal + a scope
     * coexisting. Such a document is returned because of its flag, not its
     * scope — counting its scope as "matched" suppressed the warning in exactly
     * the case it exists for, no SCOPED expertise having answered.
     */
    it('warns when only a transversal expertise carries the requested scope', async () => {
      mockReturnDocs([
        {
          expertiseId: 'general',
          isTransversal: true,
          category: 'redaction',
          scope: ['cta'],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      Expertises.distinct.mockResolvedValue(['cta']);

      const out = await findApplicable({
        scope: 'cta',
        categories: ['redaction'],
      });

      expect(out).toHaveLength(1);
      await flushWarning();
      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(logger.warn.mock.calls[0][0]).toContain('cta');
    });

    it('warns about the unmatched scope only, not the ones that matched', async () => {
      mockReturnDocs([
        {
          expertiseId: 'cta-principles',
          category: 'redaction',
          scope: ['cta'],
          activeVersion: { major: 1, minor: 0 },
          versions: [{ versionMajor: 1, versionMinor: 0, body: 'x' }],
        },
      ]);
      Expertises.distinct.mockResolvedValue(['cta']);
      await findApplicable({
        scope: ['cta', 'bouton'],
        categories: ['redaction'],
      });
      await flushWarning();
      const message = logger.warn.mock.calls[0][0];
      expect(message).toContain('bouton');
      expect(message).not.toContain('["cta"] matched');
    });

    it('never lets the diagnostic break the invocation it diagnoses', async () => {
      mockReturnDocs([]);
      Expertises.distinct.mockRejectedValue(new Error('connection lost'));
      await expect(
        findApplicable({ scope: 'bouton', categories: ['redaction'] })
      ).resolves.toEqual([]);
      await flushWarning();
      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });
});
