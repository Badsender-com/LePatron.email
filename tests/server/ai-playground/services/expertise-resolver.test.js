'use strict';

jest.mock('../../../../packages/server/common/models.common', () => ({
  Expertises: { find: jest.fn() },
}));
jest.mock(
  '../../../../packages/server/ai-skill/repositories/expertise.repository',
  () => ({ findApplicable: jest.fn() })
);

const {
  resolveExpertise,
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

  it('returns [] when filter does not match any expertise (delegated to repo)', async () => {
    expertiseRepo.findApplicable.mockResolvedValue([]);
    const out = await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: { scope: ['cta'] },
    });
    expect(out).toEqual([]);
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: ['cta'],
      emailType: undefined,
      language: undefined,
    });
  });

  it('passes filter args correctly when scope+emailType+language are set', async () => {
    expertiseRepo.findApplicable.mockResolvedValue([]);
    await resolveExpertise({
      expertiseRefs: [],
      expertiseFilter: { scope: ['cta'], emailType: 'promo', language: 'fr' },
    });
    expect(expertiseRepo.findApplicable).toHaveBeenCalledWith({
      scope: ['cta'],
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
