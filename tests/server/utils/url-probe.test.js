'use strict';

// Every address the quality checks fetch was typed by a user: the SSRF guard
// must hold on the first request and on every redirect.

jest.mock('../../../packages/server/utils/outbound-host.js', () => {
  const actual = jest.requireActual(
    '../../../packages/server/utils/outbound-host.js'
  );
  return { ...actual, assertOutboundHostAllowed: jest.fn() };
});

const dns = require('dns');
const outboundHost = require('../../../packages/server/utils/outbound-host.js');
const {
  probeUrl,
  PROBE_FAILURES,
} = require('../../../packages/server/utils/url-probe.js');

function response(status, headers = {}, body = '') {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name.toLowerCase()] || null },
    body: { destroy: jest.fn() },
    buffer: async () => Buffer.from(body),
  };
}

const never = () => new Promise(() => {});

beforeEach(() => {
  outboundHost.assertOutboundHostAllowed.mockReset();
  outboundHost.assertOutboundHostAllowed.mockResolvedValue();
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('probeUrl', () => {
  it('follows redirects, checking every host on the way', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(301, { location: 'https://b.test/x' }))
      .mockResolvedValueOnce(response(200, { 'content-type': 'text/html' }));

    const result = await probeUrl('https://a.test', { fetchImpl });

    expect(result).toMatchObject({ status: 200, url: 'https://b.test/x' });
    expect(outboundHost.assertOutboundHostAllowed.mock.calls).toEqual([
      ['https://a.test'],
      ['https://b.test/x'],
    ]);
    // No redirect is left to node-fetch, which would not check the new host.
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: 'manual' });
  });

  it('connects only to addresses the guarded lookup accepted', async () => {
    const fetchImpl = jest.fn(async () => response(200));
    await probeUrl('https://a.test', { fetchImpl });

    // node-fetch asks the agent per URL; the socket then resolves the name
    // through the agent's lookup, the only guard against a name that resolves
    // to a private address (or starts doing so after the first check).
    const { agent } = fetchImpl.mock.calls[0][1];
    const lookup = agent(new URL('https://a.test')).options.lookup;
    expect(lookup).toBe(outboundHost.guardedLookup);
    expect(agent(new URL('http://a.test')).options.lookup).toBe(
      outboundHost.guardedLookup
    );

    jest
      .spyOn(dns, 'lookup')
      .mockImplementation((hostname, options, cb) =>
        cb(null, [{ address: '10.0.0.1', family: 4 }])
      );
    const refused = await new Promise((resolve) =>
      lookup('a.test', {}, (err, address) => resolve({ err, address }))
    );
    expect(refused.address).toBeUndefined();
    expect(refused.err.code).toBe(outboundHost.BLOCKED_HOST_ERROR_CODE);
  });

  it('stops at a redirect towards a private address', async () => {
    const refused = Object.assign(new Error('private'), {
      code: outboundHost.OUTBOUND_HOST_ERRORS.PRIVATE_ADDRESS,
    });
    outboundHost.assertOutboundHostAllowed
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(refused);
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response(302, { location: 'http://169.254.169.254/latest' })
      );

    await expect(
      probeUrl('https://a.test', { fetchImpl })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.REFUSED });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('resolves a relative redirect against the address that sent it', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(302, { location: '../next?x=1' }))
      .mockResolvedValueOnce(response(200));
    const result = await probeUrl('https://a.test/dir/sub/page', { fetchImpl });
    expect(result.url).toBe('https://a.test/dir/next?x=1');
    expect(outboundHost.assertOutboundHostAllowed).toHaveBeenLastCalledWith(
      'https://a.test/dir/next?x=1'
    );
  });

  it('gives up on a redirect without a target', async () => {
    const redirect = response(302);
    const fetchImpl = jest.fn().mockResolvedValueOnce(redirect);
    await expect(
      probeUrl('https://a.test', { fetchImpl })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });
    expect(redirect.body.destroy).toHaveBeenCalled();
  });

  it('refuses a redirect to another port when asked for the default ones', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(
        response(302, { location: 'https://victim.test:6379/' })
      );
    await expect(
      probeUrl('https://a.test', { fetchImpl, defaultPortsOnly: true })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('takes an explicit default port for the default one', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce(response(302, { location: 'http://b.test:80/' }))
      .mockResolvedValueOnce(response(200));
    await expect(
      probeUrl('https://a.test:443/x', { fetchImpl, defaultPortsOnly: true })
    ).resolves.toMatchObject({ status: 200, url: 'http://b.test/' });
  });

  it('gives up after too many redirects', async () => {
    const fetchImpl = jest.fn(async () =>
      response(302, { location: 'https://a.test/again' })
    );
    await expect(
      probeUrl('https://a.test', { fetchImpl, maxRedirects: 2 })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it('reads the body only when asked, and only of a success', async () => {
    const fetchImpl = jest.fn(async () => response(200, {}, 'abc'));
    const read = await probeUrl('https://a.test', {
      fetchImpl,
      readBody: true,
    });
    expect(read.body.toString()).toBe('abc');

    const skipped = await probeUrl('https://a.test', { fetchImpl });
    expect(skipped.body).toBeNull();
  });

  it('names the failure: missing domain, timeout', async () => {
    const dnsError = Object.assign(new Error('getaddrinfo'), {
      code: 'ENOTFOUND',
    });
    await expect(
      probeUrl('https://gone.example.com', {
        fetchImpl: jest.fn().mockRejectedValue(dnsError),
      })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.NOT_FOUND });

    const timeout = Object.assign(new Error('timeout'), {
      name: 'FetchError',
      type: 'request-timeout',
    });
    await expect(
      probeUrl('https://slow.test', {
        fetchImpl: jest.fn().mockRejectedValue(timeout),
      })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.TIMEOUT });
  });

  it('calls missing only a name under a public suffix', async () => {
    const missing = () =>
      jest
        .fn()
        .mockRejectedValue(
          Object.assign(new Error('getaddrinfo'), { code: 'ENOTFOUND' })
        );
    // A name outside the public DNS gets the same answer whether or not the
    // server's resolver knows it: the answer says nothing about that resolver.
    await expect(
      probeUrl('https://nexiste-pas.invalid', { fetchImpl: missing() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.REFUSED });
    await expect(
      probeUrl('https://intranet', { fetchImpl: missing() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.REFUSED });
    await expect(
      probeUrl('https://nexiste-pas.example.com', { fetchImpl: missing() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.NOT_FOUND });
  });

  it('does not call a domain missing when the resolver only failed for a moment', async () => {
    const again = Object.assign(new Error('getaddrinfo EAI_AGAIN'), {
      code: 'EAI_AGAIN',
    });
    await expect(
      probeUrl('https://a.example.com', {
        fetchImpl: jest.fn().mockRejectedValue(again),
      })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });

    const dnsFailed = (cause) =>
      Object.assign(new Error('Host DNS resolution failed'), {
        code: outboundHost.OUTBOUND_HOST_ERRORS.DNS_FAILED,
        cause,
      });
    outboundHost.assertOutboundHostAllowed.mockRejectedValueOnce(
      dnsFailed({ code: 'EAI_AGAIN' })
    );
    await expect(
      probeUrl('https://a.example.com', { fetchImpl: jest.fn() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });

    outboundHost.assertOutboundHostAllowed.mockRejectedValueOnce(
      dnsFailed({ code: 'ENOTFOUND' })
    );
    await expect(
      probeUrl('https://gone.example.com', { fetchImpl: jest.fn() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.NOT_FOUND });
  });

  it('gives up on a host check that outlives the deadline', async () => {
    outboundHost.assertOutboundHostAllowed.mockReturnValueOnce(never());
    await expect(
      probeUrl('https://slow-dns.test', { fetchImpl: jest.fn(), timeoutMs: 20 })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.TIMEOUT });
  });

  it('gives up on a request that outlives the deadline, and closes its late answer', async () => {
    let answer;
    const fetchImpl = jest.fn(
      () =>
        new Promise((resolve) => {
          answer = resolve;
        })
    );
    await expect(
      probeUrl('https://slow.test', { fetchImpl, timeoutMs: 20 })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.TIMEOUT });
    const late = response(200);
    answer(late);
    await new Promise((resolve) => setImmediate(resolve));
    expect(late.body.destroy).toHaveBeenCalled();
  });

  it('gives up on a body that outlives the deadline, and closes it', async () => {
    const slow = { ...response(200), buffer: never };
    await expect(
      probeUrl('https://slow.test', {
        fetchImpl: jest.fn(async () => slow),
        readBody: true,
        timeoutMs: 20,
      })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.TIMEOUT });
    expect(slow.body.destroy).toHaveBeenCalled();
  });

  it('sends no cookie and no credential', async () => {
    const fetchImpl = jest.fn(async () => response(200));
    await probeUrl('https://a.test', { fetchImpl });
    expect(Object.keys(fetchImpl.mock.calls[0][1].headers).sort()).toEqual([
      'Accept',
      'User-Agent',
    ]);
  });
});
