'use strict';

// Whether the links of an email answer: fetched as a reader would meet them,
// cached a few minutes per company, and never saying why an address was
// refused.

const { deps, run, resetQuality } = require('./quality-resources.harness.js');
const {
  ProbeError,
  PROBE_FAILURES,
} = require('../../../packages/server/utils/url-probe.js');

beforeEach(resetQuality);

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

  it('fetches an address without the credentials typed in it, and answers under the address as sent', async () => {
    const d = deps({ probe: jest.fn(async () => ({ status: 200 })) });
    const { links } = await run(
      { links: ['https://user:secret@a.test/x?y=1'] },
      d
    );
    expect(d.probe.mock.calls[0][0]).toBe('https://a.test/x?y=1');
    expect(links['https://user:secret@a.test/x?y=1']).toEqual({
      state: 'ok',
      httpStatus: 200,
    });
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
