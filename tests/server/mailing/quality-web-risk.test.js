'use strict';

// Google Web Risk, for links that lead to phishing or malware. The API key
// travels in a header, never in a URL, and must never reach a log.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const {
  apiKey,
  lookup,
  lookupUrl,
} = require('../../../packages/server/mailing/quality-web-risk.service.js');
const {
  checkResources,
  clearCacheForTests,
  WEB_RISK_LOOKUPS_PER_DAY,
} = require('../../../packages/server/mailing/quality-resources.service.js');

const KEY = 'AIza-test-key';
const answer = (status, body) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
});

beforeEach(() => {
  jest.clearAllMocks();
  clearCacheForTests();
});

describe('lookup', () => {
  it('asks for phishing, malware and unwanted software, the address encoded', () => {
    const url = new URL(lookupUrl('https://a.test/?q=1&r=2'));
    expect(url.origin + url.pathname).toBe(
      'https://webrisk.googleapis.com/v1/uris:search'
    );
    expect(url.searchParams.getAll('threatTypes')).toEqual([
      'SOCIAL_ENGINEERING',
      'MALWARE',
      'UNWANTED_SOFTWARE',
    ]);
    expect(url.searchParams.get('uri')).toBe('https://a.test/?q=1&r=2');
    expect(url.searchParams.has('key')).toBe(false);
  });

  it('sends the key in a header, never in the URL', async () => {
    const fetchImpl = jest.fn(async () => answer(200, {}));
    await lookup('https://a.test', KEY, { fetchImpl });
    const [requested, options] = fetchImpl.mock.calls[0];
    expect(requested).not.toContain(KEY);
    expect(options.headers).toEqual({ 'X-Goog-Api-Key': KEY });
  });

  it('reads a listed address, and a clean one', async () => {
    const listed = jest.fn(async () =>
      answer(200, { threat: { threatTypes: ['SOCIAL_ENGINEERING'] } })
    );
    expect(
      await lookup('https://bad.test', KEY, { fetchImpl: listed })
    ).toEqual(['SOCIAL_ENGINEERING']);
    const clean = jest.fn(async () => answer(200, {}));
    expect(
      await lookup('https://good.test', KEY, { fetchImpl: clean })
    ).toEqual([]);
  });

  it('judges nothing when Google does not answer, and logs no key', async () => {
    expect(
      await lookup('https://a.test', KEY, {
        fetchImpl: async () => answer(403, {}),
      })
    ).toBeNull();
    expect(
      await lookup('https://a.test', KEY, {
        fetchImpl: async () => {
          throw Object.assign(new Error(`timeout ${KEY}`), {
            name: 'FetchError',
          });
        },
      })
    ).toBeNull();
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain(KEY);
  });

  it('is off without a key', () => {
    expect(apiKey('')).toBeNull();
    expect(apiKey(undefined)).toBeNull();
    expect(apiKey(` ${KEY} `)).toBe(KEY);
  });
});

describe('in a quality run', () => {
  const deps = (overrides) => ({
    probe: jest.fn(async () => ({ status: 200 })),
    fetchOwn: jest.fn(),
    resolve4: jest.fn(),
    zones: () => [],
    webRiskKey: () => KEY,
    webRiskLookup: jest.fn(async (url) =>
      url.includes('bad') ? ['MALWARE'] : []
    ),
    ...overrides,
  });
  const run = (links, d, userKey = 'u1') =>
    checkResources(
      { links, images: [] },
      { userKey, cacheScope: 'c1', ownHosts: [] },
      d
    );

  it('reports the listed links only', async () => {
    const { webRisk } = await run(
      ['https://bad.test', 'https://good.test'],
      deps()
    );
    expect(webRisk).toEqual({
      enabled: true,
      threats: { 'https://bad.test': ['MALWARE'] },
    });
  });

  it('is off, and asks nothing, without a key', async () => {
    const d = deps({ webRiskKey: () => null });
    const { webRisk } = await run(['https://bad.test'], d);
    expect(webRisk).toEqual({ enabled: false, threats: {} });
    expect(d.webRiskLookup).not.toHaveBeenCalled();
  });

  it('asks once for addresses that differ only by their query string', async () => {
    const d = deps();
    await run(['https://a.test/p?utm=1', 'https://a.test/p?utm=2'], d);
    expect(d.webRiskLookup).toHaveBeenCalledTimes(1);
  });

  it("stops asking once the company's daily budget is spent", async () => {
    const d = deps();
    const links = (n) =>
      Array.from({ length: n }, (_, i) => `https://site${i}.test/`);
    const runs = Math.ceil(WEB_RISK_LOOKUPS_PER_DAY / 60);
    for (let i = 0; i < runs; i++) {
      // Distinct users: the per-user throttle is not what is tested here.
      await run(
        links(60).map((url) => `${url}${i}`),
        d,
        `u${i}`
      );
    }
    expect(d.webRiskLookup).toHaveBeenCalledTimes(WEB_RISK_LOOKUPS_PER_DAY);
    const { webRisk } = await run(['https://bad.test/late'], d, 'late');
    expect(webRisk.threats).toEqual({});
    expect(d.webRiskLookup).toHaveBeenCalledTimes(WEB_RISK_LOOKUPS_PER_DAY);
  });

  it('asks again what Google could not answer', async () => {
    const d = deps({ webRiskLookup: jest.fn(async () => null) });
    await run(['https://a.test'], d);
    await run(['https://a.test'], d, 'u2');
    expect(d.webRiskLookup).toHaveBeenCalledTimes(2);
  });
});
