'use strict';

// The editor names the checks that are on: a run does only what theirs need.
// A link is sent for the blocklists or Web Risk as well, and must not be
// visited when "broken-links" is off. Without the list (an editor from before
// it), every check runs, as it always has.

const { deps, run, resetQuality } = require('./quality-resources.harness.js');
const {
  validateResourcesPayload,
} = require('../../../packages/server/mailing/quality-resources.service.js');

beforeEach(resetQuality);

const LINK = 'https://brand.test/offer';
const IMAGE = 'https://cdn.test/hero.png';
const ALL_CHECKS = [
  'broken-links',
  'dangerous-links',
  'domain-blocklists',
  'image-weight',
  'images-total-weight',
  'oversized-images',
];

// Every third party configured: what is not asked is the run's choice.
function configured() {
  return deps({
    zones: () => [{ name: 'DBL', zone: 'dbl.test' }],
    webRiskKey: () => 'key',
    webRiskLookup: jest.fn(async () => []),
  });
}

const resources = (checks) => ({
  links: [LINK],
  images: [IMAGE],
  ...(checks ? { checks } : {}),
});

// What each third party was asked, read off the injected dependencies.
function asked(d) {
  const probed = d.probe.mock.calls.map(([url]) => url);
  return {
    linkVisited: probed.includes(LINK),
    imageDownloaded: probed.includes(IMAGE),
    webRisk: d.webRiskLookup.mock.calls.length > 0,
    blocklists: d.resolve4.mock.calls.length > 0,
  };
}

describe('a run, for the checks the editor names', () => {
  it('does everything when the editor names none', async () => {
    const d = configured();
    const result = await run(resources(), d);

    expect(asked(d)).toEqual({
      linkVisited: true,
      imageDownloaded: true,
      webRisk: true,
      blocklists: true,
    });
    expect(Object.keys(result.links)).toEqual([LINK]);
    expect(Object.keys(result.images)).toEqual([IMAGE]);
  });

  it('does everything when the editor names every check', async () => {
    const d = configured();
    await run(resources(ALL_CHECKS), d);

    expect(asked(d)).toEqual({
      linkVisited: true,
      imageDownloaded: true,
      webRisk: true,
      blocklists: true,
    });
  });

  it('visits no link without "broken-links", Web Risk and blocklists still asked', async () => {
    const d = configured();
    const result = await run(
      resources(['dangerous-links', 'domain-blocklists']),
      d
    );

    expect(asked(d)).toEqual({
      linkVisited: false,
      imageDownloaded: false,
      webRisk: true,
      blocklists: true,
    });
    expect(result.links).toEqual({});
    expect(result.images).toEqual({});
    expect(result.webRisk.enabled).toBe(true);
    expect(result.blocklists.enabled).toBe(true);
  });

  it('asks Web Risk only for "dangerous-links"', async () => {
    const d = configured();
    const result = await run(resources(['broken-links']), d);

    expect(asked(d)).toEqual({
      linkVisited: true,
      imageDownloaded: false,
      webRisk: false,
      blocklists: false,
    });
    expect(d.spendWebRiskLookup).not.toHaveBeenCalled();
    expect(result.webRisk).toEqual({
      enabled: false,
      threats: {},
      unchecked: [],
    });
    expect(result.blocklists).toEqual({
      enabled: false,
      listed: {},
      unchecked: [],
    });
  });

  it('downloads the images for any image check, and only then', async () => {
    for (const check of [
      'image-weight',
      'images-total-weight',
      'oversized-images',
    ]) {
      resetQuality();
      const d = configured();
      await run(resources([check]), d);
      expect([check, asked(d)]).toEqual([
        check,
        {
          linkVisited: false,
          imageDownloaded: true,
          webRisk: false,
          blocklists: false,
        },
      ]);
    }
  });

  // The editor's format check judges an image whose address names no format
  // by the type the server reads in it.
  it('downloads the images for the image format check', async () => {
    const d = configured();
    const result = await run(resources(['unsupported-image-formats']), d);

    expect(asked(d)).toEqual({
      linkVisited: false,
      imageDownloaded: true,
      webRisk: false,
      blocklists: false,
    });
    expect(Object.keys(result.images)).toEqual([IMAGE]);
  });

  it('does nothing for an empty list', async () => {
    const d = configured();
    await run(resources([]), d);

    expect(asked(d)).toEqual({
      linkVisited: false,
      imageDownloaded: false,
      webRisk: false,
      blocklists: false,
    });
  });
});

describe('validateResourcesPayload — checks', () => {
  it('keeps the distinct checks sent, and nothing when none is sent', () => {
    expect(
      validateResourcesPayload({
        links: [LINK],
        checks: ['broken-links', 'broken-links', 'image-weight'],
      })
    ).toEqual({
      links: [LINK],
      images: [],
      checks: ['broken-links', 'image-weight'],
    });
    expect(validateResourcesPayload({ links: [LINK] })).not.toHaveProperty(
      'checks'
    );
  });

  it.each([
    ['a list that is not one', 'broken-links'],
    ['a check the server does not run', ['subject']],
    ['an inherited name', ['constructor']],
    ['an id that is not a string', [{ id: 'broken-links' }]],
  ])('refuses %s', (_label, checks) => {
    expect(() => validateResourcesPayload({ links: [], checks })).toThrow(
      expect.objectContaining({
        status: 422,
        message: 'INVALID_QUALITY_RESOURCES',
      })
    );
  });
});
