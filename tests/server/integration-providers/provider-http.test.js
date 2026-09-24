'use strict';

const http = require('http');
const dns = require('dns');
const { FetchError } = jest.requireActual('node-fetch');

const OUTBOUND_HOST = '../../../packages/server/utils/outbound-host.js';
const PROVIDER_HTTP =
  '../../../packages/server/integration-providers/provider-http.js';
const {
  PROVIDER_ERROR_CODES: CODES,
} = require('../../../packages/server/integration-providers/provider-error.js');

/**
 * Load provider-http with node-fetch stubbed and the pre-request host check
 * passing, to exercise what happens around the call.
 */
function loadWithFetch(mockFetch) {
  let loaded;
  jest.isolateModules(() => {
    jest.doMock('node-fetch', () => mockFetch);
    jest.doMock(OUTBOUND_HOST, () => ({
      ...jest.requireActual(OUTBOUND_HOST),
      assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
    }));
    loaded = require(PROVIDER_HTTP);
  });
  return loaded;
}

function response(status, body = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: jest.fn().mockResolvedValue(body),
  };
}

describe('provider-http', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('guardedFetch', () => {
    it('never lets node-fetch follow a redirect, and bounds the body', async () => {
      const mockFetch = jest.fn().mockResolvedValue(response(200));
      const { guardedFetch } = loadWithFetch(mockFetch);

      await guardedFetch('https://api.example.com/v1/models', {
        headers: { Authorization: 'Bearer k' },
        timeoutMs: 1234,
      });

      const options = mockFetch.mock.calls[0][1];
      expect(options.redirect).toBe('manual');
      expect(options.timeout).toBe(1234);
      expect(options.size).toBeGreaterThan(0);
      expect(typeof options.agent).toBe('function');
    });

    // node-fetch keeps x-api-key / api-key across hosts on a redirect: the
    // redirect target would receive the key in clear.
    it.each([301, 302, 307, 308])('refuses a %s redirect', async (status) => {
      const mockFetch = jest.fn().mockResolvedValue(response(status));
      const { guardedFetch } = loadWithFetch(mockFetch);

      await expect(
        guardedFetch('https://api.example.com/v1/models', {})
      ).rejects.toMatchObject({ code: CODES.API_ERROR });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns a non-2xx, non-redirect response as is', async () => {
      const { guardedFetch } = loadWithFetch(
        jest.fn().mockResolvedValue(response(401))
      );

      const result = await guardedFetch('https://api.example.com/v1/models');

      expect(result.status).toBe(401);
    });

    it.each([
      ['request-timeout', undefined, CODES.TIMEOUT],
      ['body-timeout', undefined, CODES.TIMEOUT],
      ['max-size', undefined, CODES.INVALID_RESPONSE],
      ['system', 'EBLOCKEDHOST', CODES.CONFIG_ERROR],
      ['system', 'ECONNREFUSED', CODES.API_ERROR],
    ])('maps a %s (%s) failure to %s', async (type, code, expected) => {
      const error = new FetchError(
        'request to http://10.0.0.12:9200/ failed',
        type,
        code ? { code } : undefined
      );
      const { guardedFetch } = loadWithFetch(
        jest.fn().mockRejectedValue(error)
      );

      const thrown = await guardedFetch('https://api.example.com/').catch(
        (e) => e
      );

      // By name: isolateModules loads a copy of the ProviderError class.
      expect(thrown).toMatchObject({ name: 'ProviderError', code: expected });
      // The message may reach the client: never the address that was tried.
      expect(thrown.message).not.toContain('10.0.0.12');
    });

    it('lets a caller-owned abort through untouched', async () => {
      const abort = new Error('aborted');
      abort.name = 'AbortError';
      const { guardedFetch } = loadWithFetch(
        jest.fn().mockRejectedValue(abort)
      );

      await expect(guardedFetch('https://api.example.com/')).rejects.toBe(
        abort
      );
    });
  });

  describe('fetchProviderJson', () => {
    it('returns the parsed body', async () => {
      const { fetchProviderJson } = loadWithFetch(
        jest.fn().mockResolvedValue(response(200, { data: [{ id: 'x' }] }))
      );

      await expect(
        fetchProviderJson('https://api.example.com/v1/models', {
          label: 'listing',
        })
      ).resolves.toEqual({ data: [{ id: 'x' }] });
    });

    it.each([
      [401, CODES.INVALID_CREDENTIALS],
      [429, CODES.QUOTA_EXCEEDED],
      [500, CODES.API_ERROR],
    ])('maps a %s to %s by default', async (status, expected) => {
      const { fetchProviderJson } = loadWithFetch(
        jest.fn().mockResolvedValue(response(status))
      );

      await expect(
        fetchProviderJson('https://api.example.com/', { label: 'listing' })
      ).rejects.toMatchObject({ code: expected });
    });

    // The body read is where size and time limits bite, so its failures must
    // come out typed too.
    it('types a failure while reading the body', async () => {
      const failing = response(200);
      failing.json.mockRejectedValue(
        new FetchError('content size at x over limit: 10', 'max-size')
      );
      const { fetchProviderJson } = loadWithFetch(
        jest.fn().mockResolvedValue(failing)
      );

      await expect(
        fetchProviderJson('https://api.example.com/', { label: 'listing' })
      ).rejects.toMatchObject({ code: CODES.INVALID_RESPONSE });
    });
  });

  // Real sockets, real node-fetch: the pre-request check is made to pass, as
  // it would for a TTL-0 domain answering a public address first. The request
  // must still be refused, because it resolves the name again through
  // guardedLookup and connects only to what that validated.
  describe('DNS rebinding', () => {
    let server;
    let port;
    let hits;

    beforeAll(async () => {
      hits = 0;
      server = http.createServer((req, res) => {
        hits += 1;
        res.end('{}');
      });
      await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
      port = server.address().port;
    });

    afterAll(() => new Promise((resolve) => server.close(resolve)));

    function loadWithRealFetch() {
      let loaded;
      jest.isolateModules(() => {
        // doMock outlives isolateModules: undo the stub the tests above set.
        jest.dontMock('node-fetch');
        jest.doMock(OUTBOUND_HOST, () => ({
          ...jest.requireActual(OUTBOUND_HOST),
          assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
        }));
        loaded = require(PROVIDER_HTTP);
      });
      return loaded;
    }

    it('does not connect when the name resolves to a private address at request time', async () => {
      jest
        .spyOn(dns, 'lookup')
        .mockImplementation((hostname, options, cb) =>
          cb(null, [{ address: '127.0.0.1', family: 4 }])
        );
      const { guardedFetch } = loadWithRealFetch();

      const thrown = await guardedFetch(
        `http://rebind.example.com:${port}/`
      ).catch((e) => e);

      expect(thrown).toMatchObject({
        name: 'ProviderError',
        code: CODES.CONFIG_ERROR,
      });
      expect(hits).toBe(0);
    });
  });
});
