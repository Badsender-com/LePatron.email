'use strict';

// Every address the quality checks fetch was typed by a user: the SSRF guard
// must hold on the first request and on every redirect.

jest.mock('../../../packages/server/utils/outbound-host.js', () => {
  const actual = jest.requireActual(
    '../../../packages/server/utils/outbound-host.js'
  );
  return { ...actual, assertOutboundHostAllowed: jest.fn() };
});

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

beforeEach(() => {
  outboundHost.assertOutboundHostAllowed.mockReset();
  outboundHost.assertOutboundHostAllowed.mockResolvedValue();
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
      probeUrl('https://gone.test', {
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

  it('does not call a domain missing when the resolver only failed for a moment', async () => {
    const again = Object.assign(new Error('getaddrinfo EAI_AGAIN'), {
      code: 'EAI_AGAIN',
    });
    await expect(
      probeUrl('https://a.test', {
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
      probeUrl('https://a.test', { fetchImpl: jest.fn() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.UNREACHABLE });

    outboundHost.assertOutboundHostAllowed.mockRejectedValueOnce(
      dnsFailed({ code: 'ENOTFOUND' })
    );
    await expect(
      probeUrl('https://gone.test', { fetchImpl: jest.fn() })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.NOT_FOUND });
  });

  it('gives up on a host check that outlives the deadline', async () => {
    outboundHost.assertOutboundHostAllowed.mockReturnValueOnce(
      new Promise(() => {})
    );
    await expect(
      probeUrl('https://slow-dns.test', { fetchImpl: jest.fn(), timeoutMs: 20 })
    ).rejects.toMatchObject({ reason: PROBE_FAILURES.TIMEOUT });
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
