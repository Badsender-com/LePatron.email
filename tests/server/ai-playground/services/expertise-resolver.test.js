'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn() },
}));
// `findApplicable` is mocked (it is the filter path under test), but
// `projectVersion` is kept REAL: it is the shared projection the explicit path
// now goes through, and the assertions below are about its output.
jest.mock(
  '../../../../packages/server/ai-skill/repositories/expertise.repository',
  () => {
    const actual = jest.requireActual(
      '../../../../packages/server/ai-skill/repositories/expertise.repository'
    );
    return { findApplicable: jest.fn(), projectVersion: actual.projectVersion };
  }
);

const {
  resolveExpertise,
  previewFilter,
  normaliseFilter,
} = require('../../../../packages/server/ai-playground/services/expertise-resolver.service');
const {
  Expertises,
} = require('../../../../packages/server/common/models.common');
const expertiseRepo = require('../../../../packages/server/ai-skill/repositories/expertise.repository');

beforeEach(() => jest.clearAllMocks());

function findReturn(value) {
  Expertises.find.mockReturnValue({ lean: () => Promise.resolve(value) });
}

describe('expertise-resolver.resolveExpertise', () => {
  it('returns [] when there is no expertiseRefs and no filter (mode "none")', async () => {
    const out = await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: { scope: [], emailType: null, language: null },
    });
    expect(out).toEqual([]);
    expect(Expertises.find).not.toHaveBeenCalled();
    expect(expertiseRepo.findApplicable).not.toHaveBeenCalled();
  });

  it('does NOT call the repo when the filter has a scope but no categories', async () => {
    const out = await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: { scope: ['cta'] },
    });
    expect(out).toEqual([]);
    expect(expertiseRepo.findApplicable).not.toHaveBeenCalled();
  });

  it('returns [] when filter does not match any expertise (delegated to repo)', async () => {
    expertiseRepo.findApplicable.mockResolvedValue([]);
    const out = await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: { scope: ['cta'], categories: ['redaction'] },
    });
    expect(out).toEqual([]);
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: ['cta'],
      categories: ['redaction'],
      emailType: undefined,
      language: undefined,
    });
  });

  it('passes scope+categories+emailType+language to the repo', async () => {
    expertiseRepo.findApplicable.mockResolvedValue([]);
    await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: {
        scope: ['cta'],
        categories: ['redaction'],
        emailType: 'promo',
        language: 'fr',
      },
    });
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: ['cta'],
      categories: ['redaction'],
      emailType: 'promo',
      language: 'fr',
    });
  });

  it('explicit mode wins over filter when refs is non-empty', async () => {
    findReturn([
      {
        expertiseId: 'e1',
        title: 'E1',
        category: 'redaction',
        scope: ['cta'],
        activeVersion: { major: 2, minor: 0 },
        versions: [
          { versionMajor: 2, versionMinor: 0, body: 'b', examplesGood: ['ok'] },
        ],
      },
    ]);
    const out = await resolveExpertise({
      expertiseRefs: [{ expertiseId: 'e1', mode: 'active' }],
      expertiseFilter: { scope: ['cta'] },
    });
    expect(expertiseRepo.findApplicable).not.toHaveBeenCalled();
    expect(out).toHaveLength(1);
    expect(out[0].body).toBe('b');
    expect(out[0].versionMajor).toBe(2);
  });

  it('explicit mode preserves expertiseRefs order (not the DB order)', async () => {
    // The $in query returns docs in an arbitrary order; the resolver must
    // follow expertiseRefs — that order is what the prompt composes with.
    const mk = (id) => ({
      expertiseId: id,
      title: id,
      category: 'redaction',
      scope: ['cta'],
      activeVersion: { major: 1, minor: 0 },
      versions: [{ versionMajor: 1, versionMinor: 0, body: id }],
    });
    findReturn([mk('c'), mk('a'), mk('b')]);
    const out = await resolveExpertise({
      expertiseRefs: [
        { expertiseId: 'a', mode: 'active' },
        { expertiseId: 'b', mode: 'active' },
        { expertiseId: 'c', mode: 'active' },
      ],
    });
    expect(out.map((e) => e.expertiseId)).toEqual(['a', 'b', 'c']);
  });

  it('explicit mode pinned: picks the requested version', async () => {
    findReturn([
      {
        expertiseId: 'e1',
        title: 'E1',
        category: 'redaction',
        scope: [],
        activeVersion: { major: 2, minor: 0 },
        versions: [
          { versionMajor: 1, versionMinor: 0, body: 'old' },
          { versionMajor: 2, versionMinor: 0, body: 'new' },
        ],
      },
    ]);
    const out = await resolveExpertise({
      expertiseRefs: [
        {
          expertiseId: 'e1',
          mode: 'pinned',
          versionMajor: 1,
          versionMinor: 0,
        },
      ],
    });
    expect(out[0].body).toBe('old');
  });

  it('throws when an explicit ref points to a missing expertise', async () => {
    findReturn([]);
    await expect(
      resolveExpertise({
        expertiseRefs: [{ expertiseId: 'missing', mode: 'active' }],
      })
    ).rejects.toMatchObject({ status: 404 });
  });

  it('throws when a pinned version does not exist', async () => {
    findReturn([
      {
        expertiseId: 'e1',
        activeVersion: { major: 1, minor: 0 },
        versions: [{ versionMajor: 1, versionMinor: 0, body: 'b' }],
      },
    ]);
    await expect(
      resolveExpertise({
        expertiseRefs: [
          {
            expertiseId: 'e1',
            mode: 'pinned',
            versionMajor: 9,
            versionMinor: 0,
          },
        ],
      })
    ).rejects.toMatchObject({ status: 404 });
  });
});

// The normalisation the controller used to do by hand, two layers down.
describe('normaliseFilter', () => {
  it('wraps single query values into arrays', () => {
    expect(normaliseFilter({ scope: 'cta', categories: 'redaction' })).toEqual({
      scope: ['cta'],
      categories: ['redaction'],
      emailType: null,
      language: null,
    });
  });

  it('keeps repeated values and drops empties', () => {
    expect(
      normaliseFilter({
        scope: ['cta', 'objet'],
        emailType: '',
        language: 'fr',
      })
    ).toEqual({
      scope: ['cta', 'objet'],
      categories: [],
      emailType: null,
      language: 'fr',
    });
  });

  it('answers a fully-shaped filter for an empty query', () => {
    expect(normaliseFilter()).toEqual({
      scope: [],
      categories: [],
      emailType: null,
      language: null,
    });
  });
});

describe('previewFilter', () => {
  it('returns the count and a trimmed item list', async () => {
    expertiseRepo.findApplicable.mockResolvedValue([
      {
        expertiseId: 'a',
        title: 'A',
        versionMajor: 1,
        versionMinor: 0,
        body: 'secret doctrine',
      },
    ]);
    const out = await previewFilter({ scope: 'cta', categories: 'redaction' });
    expect(out.count).toBe(1);
    // The preview is a count, not a content dump.
    expect(out.items).toEqual([
      { expertiseId: 'a', title: 'A', versionMajor: 1, versionMinor: 0 },
    ]);
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: ['cta'],
      categories: ['redaction'],
      emailType: null,
      language: null,
    });
  });

  // resolveExpertise treats an incomplete filter as "no filter"; the preview
  // must let the 400 through, or an incomplete filter reads as "0 matches".
  it('propagates the repository error instead of returning count 0', async () => {
    const err = Object.assign(new Error('categories required'), {
      status: 400,
    });
    expertiseRepo.findApplicable.mockRejectedValue(err);
    await expect(previewFilter({ scope: 'cta' })).rejects.toMatchObject({
      status: 400,
    });
  });
});
