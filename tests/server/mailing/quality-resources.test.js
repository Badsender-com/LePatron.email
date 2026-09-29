'use strict';

// The server measures what the editor sends it: whether links answer, what
// images weigh once exported, whether a domain is on a blocklist. It fetches
// addresses any logged-in user typed, so the bounds matter as much as the
// results: both are pinned here.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
}));

const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing-quality.controller.js');
const {
  validateResourcesPayload,
  checkResources,
  MAX_LINKS,
  RUNS_PER_WINDOW,
  clearCacheForTests,
} = require('../../../packages/server/mailing/quality-resources.service.js');
const {
  measuredUrl,
  fetchOwn,
} = require('../../../packages/server/mailing/quality-images.service.js');
const {
  blocklistZones,
  isListing,
} = require('../../../packages/server/mailing/quality-blocklists.service.js');
const {
  ProbeError,
  PROBE_FAILURES,
} = require('../../../packages/server/utils/url-probe.js');

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function deps(overrides = {}) {
  return {
    probe: jest.fn(async () => ({ status: 200, body: ONE_PIXEL_PNG })),
    fetchOwn: jest.fn(async () => ({ status: 200, body: ONE_PIXEL_PNG })),
    resolve4: jest.fn(async () => {
      const error = new Error('queryA ENOTFOUND');
      error.code = 'ENOTFOUND';
      throw error;
    }),
    zones: () => [],
    webRiskKey: () => null,
    webRiskLookup: jest.fn(),
    ...overrides,
  };
}

const run = (resources, d, context = {}) =>
  checkResources(
    { links: [], images: [], ...resources },
    { userKey: 'u1', cacheScope: 'c1', ownHosts: ['app.test'], ...context },
    d
  );

beforeEach(() => {
  clearCacheForTests();
  jest.resetAllMocks();
});

describe('validateResourcesPayload', () => {
  it('keeps distinct http(s) addresses, as sent', () => {
    expect(
      validateResourcesPayload({
        links: ['https://a.test/x', 'https://a.test/x', 'http://b.test'],
        images: [{ url: 'https://a.test/i.png' }],
      })
    ).toEqual({
      links: ['https://a.test/x', 'http://b.test'],
      images: ['https://a.test/i.png'],
    });
  });

  it.each([
    ['another key', { links: [], extra: 1 }],
    ['a non-web scheme', { links: ['javascript:alert(1)'] }],
    ['a file URL', { images: [{ url: 'file:///etc/passwd' }] }],
    ['not a URL', { links: ['nope'] }],
    ['too many links', { links: Array(MAX_LINKS + 1).fill('https://a.test') }],
    ['an overlong URL', { links: [`https://a.test/${'x'.repeat(2100)}`] }],
    ['a list that is not one', { links: 'https://a.test' }],
  ])('refuses %s', (label, body) => {
    expect(() => validateResourcesPayload(body)).toThrow(
      expect.objectContaining({
        status: 422,
        message: 'INVALID_QUALITY_RESOURCES',
      })
    );
  });
});

describe('links', () => {
  it.each([
    [200, 'ok'],
    [404, 'broken'],
    [410, 'broken'],
    [500, 'broken'],
    [403, 'unverifiable'],
    [429, 'unverifiable'],
    // Cloudflare's challenge, a proxy's bad moment, LinkedIn to robots.
    [503, 'unverifiable'],
    [502, 'unverifiable'],
    [999, 'unverifiable'],
  ])('reads a %s as %s', async (status, state) => {
    const d = deps({ probe: jest.fn(async () => ({ status })) });
    const { links } = await run({ links: ['https://a.test/p'] }, d);
    expect(links['https://a.test/p']).toEqual({ state, httpStatus: status });
  });

  it('calls a domain that does not exist broken, a timeout unverifiable', async () => {
    const d = deps({
      probe: jest.fn(async (url) => {
        throw new ProbeError(
          url.includes('gone')
            ? PROBE_FAILURES.NOT_FOUND
            : PROBE_FAILURES.TIMEOUT
        );
      }),
    });
    const { links } = await run(
      { links: ['https://gone.test', 'https://slow.test'] },
      d
    );
    expect(links['https://gone.test']).toEqual({
      state: 'broken',
      reason: 'not-found',
    });
    expect(links['https://slow.test']).toEqual({
      state: 'unverifiable',
      reason: 'timeout',
    });
  });

  it('asks each address once within a few minutes', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    await run({ links: ['https://a.test'] }, d);
    await run({ links: ['https://a.test'] }, d);
    expect(d.probe).toHaveBeenCalledTimes(1);
  });

  it('asks again what did not answer in time', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.TIMEOUT);
      }),
    });
    await run({ links: ['https://slow.test'] }, d);
    await run({ links: ['https://slow.test'] }, d);
    expect(d.probe).toHaveBeenCalledTimes(2);
  });

  it('keeps one company from reading what another checked', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    await run({ links: ['https://a.test'] }, d, { cacheScope: 'c1' });
    await run({ links: ['https://a.test'] }, d, {
      cacheScope: 'c2',
      userKey: 'u2',
    });
    expect(d.probe).toHaveBeenCalledTimes(2);
  });

  it('never says why an address was refused', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.REFUSED);
      }),
    });
    const { links } = await run({ links: ['https://intranet.test'] }, d);
    expect(links['https://intranet.test']).toEqual({ state: 'unverifiable' });
  });

  it('does not fetch a port other than the default ones', async () => {
    const d = deps();
    const { links, images } = await run(
      {
        links: ['http://partner.test:8443/admin'],
        images: ['https://cdn.test:25/a.png'],
      },
      d
    );
    expect(links['http://partner.test:8443/admin']).toEqual({
      state: 'unverifiable',
    });
    expect(images['https://cdn.test:25/a.png']).toEqual({
      state: 'unverifiable',
    });
    expect(d.probe).not.toHaveBeenCalled();
  });
});

describe('images', () => {
  it('weighs an image and reads its size', async () => {
    const { images } = await run(
      { images: ['https://cdn.test/a.png'] },
      deps()
    );
    expect(images['https://cdn.test/a.png']).toEqual({
      state: 'ok',
      bytes: ONE_PIXEL_PNG.length,
      width: 1,
      height: 1,
      type: 'png',
    });
  });

  it('measures our own images the way the export gets them, never at the host named', async () => {
    const d = deps();
    await run(
      { images: ['https://app.test/api/images/resize/600x0/a.png?x=1'] },
      d
    );
    expect(d.fetchOwn).toHaveBeenCalledWith(
      expect.stringMatching(
        /^http:\/\/127\.0\.0\.1:\d+\/api\/images\/resize\/600x0\/a\.png$/
      ),
      expect.any(Number)
    );
    expect(d.probe).not.toHaveBeenCalled();
  });

  it.each([
    'https://app.test/api/images/a.png',
    'https://app.test/api/images/cover/600xnull/a.png',
  ])('reads %s as one of our images', (url) => {
    expect(measuredUrl(url, ['app.test']).own).toBe(true);
  });

  it.each([
    'https://evil.test/api/images/a.png',
    'https://app.test/admin',
    'https://app.test/api/images/placeholder/30000x30000.png',
    'https://app.test/api/images/resize/99999x1/a.png',
    'https://app.test/api/images/gallery/abc',
  ])('goes through the guarded probe for %s', (url) => {
    expect(measuredUrl(url, ['app.test']).own).toBe(false);
  });

  it('does not let the host a caller names decide what an URL reads', async () => {
    const d = deps();
    // Measured as ours, under our path: never under the victim's URL.
    await run({ images: ['https://cdn.victim.test/api/images/a.png'] }, d, {
      ownHosts: ['cdn.victim.test'],
    });
    await run({ images: ['https://cdn.victim.test/api/images/a.png'] }, d, {
      userKey: 'u2',
    });
    expect(d.fetchOwn).toHaveBeenCalledTimes(1);
    expect(d.probe).toHaveBeenCalledTimes(1);
  });

  it('stops downloading once the run has spent its budget', async () => {
    const tenMb = Buffer.alloc(10 * 1024 * 1024);
    const d = deps({
      probe: jest.fn(async () => ({ status: 200, body: tenMb })),
    });
    // The budget is checked before each download: four run at once, so a run
    // may overshoot it by four images at most, never by twelve.
    const urls = Array.from(
      { length: 12 },
      (_, i) => `https://cdn.test/${i}.jpg`
    );
    const { images } = await run({ images: urls }, d);
    const states = urls.map((url) => images[url].state);
    expect(states).toContain('unverifiable');
    expect(d.probe.mock.calls.length).toBeLessThan(urls.length);
  });

  it('says "at least" for an image past the ceiling', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.TOO_LARGE);
      }),
    });
    const { images } = await run({ images: ['https://cdn.test/big.gif'] }, d);
    expect(images['https://cdn.test/big.gif']).toMatchObject({
      state: 'ok',
      atLeast: true,
    });
  });

  it('does not judge an image at an address the guard refuses', async () => {
    const d = deps({
      probe: jest.fn(async () => {
        throw new ProbeError(PROBE_FAILURES.REFUSED);
      }),
    });
    const { images } = await run(
      { images: ['http://localhost:3000/api/images/a.png'] },
      d
    );
    expect(images['http://localhost:3000/api/images/a.png']).toEqual({
      state: 'unverifiable',
    });
  });

  it('asks our own backend as if through https, since it redirects plain http outside development', async () => {
    const fetchImpl = jest.fn(async () => ({
      ok: true,
      status: 200,
      buffer: async () => ONE_PIXEL_PNG,
    }));
    await fetchOwn('http://127.0.0.1:3000/api/images/a.png', 5000, fetchImpl);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({
      headers: { 'X-Forwarded-Proto': 'https' },
      redirect: 'manual',
    });
  });

  it('does not judge an image our backend answers with a redirect or an error', async () => {
    const d = deps({
      fetchOwn: jest.fn(async () => ({ status: 302, body: null })),
    });
    const { images } = await run(
      { images: ['https://app.test/api/images/a.png'] },
      d
    );
    expect(images['https://app.test/api/images/a.png']).toEqual({
      state: 'unverifiable',
    });
  });

  it('reports an image that cannot be fetched', async () => {
    const d = deps({
      probe: jest.fn(async () => ({ status: 404, body: null })),
    });
    const { images } = await run({ images: ['https://cdn.test/x.png'] }, d);
    expect(images['https://cdn.test/x.png']).toEqual({
      state: 'unreachable',
      httpStatus: 404,
    });
  });
});

describe('blocklists', () => {
  it('are off unless configured', async () => {
    const d = deps();
    const { blocklists } = await run({ links: ['https://a.test'] }, d);
    expect(blocklists).toEqual({ enabled: false, listed: {} });
    expect(d.resolve4).not.toHaveBeenCalled();
  });

  it('reads the configured zones', () => {
    expect(
      blocklistZones(
        'Spamhaus DBL=key.dbl.dq.spamhaus.net, multi.surbl.org, bad zone'
      )
    ).toEqual([
      { name: 'Spamhaus DBL', zone: 'key.dbl.dq.spamhaus.net' },
      { name: 'multi.surbl.org', zone: 'multi.surbl.org' },
    ]);
  });

  it("queries the link's registrable domain on every zone", async () => {
    const d = deps({
      zones: () => [
        { name: 'DBL', zone: 'dbl.test' },
        { name: 'URIBL', zone: 'uribl.test' },
      ],
      resolve4: jest.fn(async (name) => {
        if (name === 'shady.co.uk.dbl.test') return ['127.0.1.2'];
        // URIBL refusing the query says nothing about the domain.
        if (name === 'shady.co.uk.uribl.test') return ['127.0.0.1'];
        const error = new Error('ENOTFOUND');
        error.code = 'ENOTFOUND';
        throw error;
      }),
    });
    const { blocklists } = await run(
      { links: ['https://www.shady.co.uk/offer', 'https://fine.test'] },
      d
    );
    expect(blocklists).toEqual({
      enabled: true,
      listed: { 'shady.co.uk': ['DBL'] },
    });
  });

  it('tells a listing from a refused query', () => {
    expect(isListing('127.0.1.2')).toBe(true);
    expect(isListing('127.0.0.2')).toBe(true);
    expect(isListing('127.0.0.1')).toBe(false);
    expect(isListing('127.255.255.254')).toBe(false);
    expect(isListing('10.0.0.1')).toBe(false);
  });
});

describe('throttle', () => {
  it('runs one check at a time per user', async () => {
    let release;
    const d = deps({
      probe: jest.fn(
        () =>
          new Promise((resolve) => {
            release = () => resolve({ status: 200 });
          })
      ),
    });
    const first = run({ links: ['https://a.test'] }, d);
    await expect(run({ links: ['https://b.test'] }, d)).rejects.toMatchObject({
      status: 429,
      message: 'QUALITY_CHECK_RUNNING',
    });
    // Another user is not held up.
    await expect(
      run({ links: [] }, d, { userKey: 'u2' })
    ).resolves.toBeDefined();
    release();
    await first;
    await expect(run({ links: ['https://a.test'] }, d)).resolves.toBeDefined();
  });

  it('allows a few runs per window, then refuses', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    for (let i = 0; i < RUNS_PER_WINDOW; i += 1) {
      await run({ links: [] }, d);
    }
    await expect(run({ links: [] }, d)).rejects.toMatchObject({
      status: 429,
      message: 'QUALITY_CHECKS_TOO_FREQUENT',
    });
  });
});

describe('POST /mailings/:mailingId/quality/resources', () => {
  it('reads nothing when the payload is invalid', async () => {
    let error;
    await controller.checkResources(
      { params: { mailingId: 'm1' }, body: { links: ['ftp://x'] }, user: {} },
      { json: jest.fn() },
      (err) => {
        error = err;
      }
    );
    expect(error.status).toBe(422);
    expect(mailingService.findOneForUser).not.toHaveBeenCalled();
  });

  it('checks nothing for someone who cannot open the email', async () => {
    const notFound = Object.assign(new Error('MAILING_NOT_FOUND'), {
      status: 404,
    });
    mailingService.findOneForUser.mockRejectedValue(notFound);
    const res = { json: jest.fn() };
    let error;
    await controller.checkResources(
      {
        params: { mailingId: 'm1' },
        body: { links: ['https://a.test'] },
        user: { id: 'u1' },
        get: () => 'app.test',
      },
      res,
      (err) => {
        error = err;
      }
    );
    expect(error).toBe(notFound);
    expect(res.json).not.toHaveBeenCalled();
  });
});
