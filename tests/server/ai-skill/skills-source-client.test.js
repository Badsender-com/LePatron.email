'use strict';

// How a copy reaches production (ADR 0019, #1425): from its configuration
// only, over https, and the page shows production's origin, nothing more.

const mockConfig = { skillsSource: {} };
jest.mock('../../../packages/server/node.config.js', () => mockConfig);
const mockGuardedFetch = jest.fn();
jest.mock(
  '../../../packages/server/integration-providers/provider-http.js',
  () => ({
    ...jest.requireActual(
      '../../../packages/server/integration-providers/provider-http.js'
    ),
    guardedFetch: (...args) => mockGuardedFetch(...args),
  })
);

const source = require('../../../packages/server/ai-skill/services/skills-source-client.js');

const configure = (url, token, nightly) => {
  mockConfig.skillsSource = { url, token, nightly };
};

// What node-fetch rejects a body with, as guardedFetch bounds it.
const fetchError = (type) =>
  Object.assign(new Error(`body ${type}`), { name: 'FetchError', type });
const answering = (error) => () =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.reject(error),
  });

describe('reaching production from a copy', () => {
  beforeEach(() => mockGuardedFetch.mockReset());

  it('follows nothing without both the address and the token', () => {
    configure('https://production.example', undefined);
    expect(source.isConfigured()).toBe(false);
    configure(undefined, 'lpsr_x');
    expect(source.isConfigured()).toBe(false);
    configure('https://production.example', 'lpsr_x');
    expect(source.isConfigured()).toBe(true);
  });

  // Each copy says whether it follows production at night too (ADR 0019).
  it('follows at night only when its configuration says so', () => {
    configure('https://production.example', 'lpsr_x', undefined);
    expect(source.isNightly()).toBe(false);
    configure('https://production.example', 'lpsr_x', 'false');
    expect(source.isNightly()).toBe(false);
    configure('https://production.example', 'lpsr_x', 'true');
    expect(source.isNightly()).toBe(true);
    configure(undefined, 'lpsr_x', 'true');
    expect(source.isNightly()).toBe(false);
  });

  it("shows production's origin only", () => {
    configure('https://user:secret@production.example/some/path?x=1', 'lpsr_x');
    expect(source.productionOrigin()).toBe('https://production.example');
  });

  it('refuses an address that is not https, calling nothing', async () => {
    configure('http://production.example', 'lpsr_x');
    await expect(source.fetchProductionExport()).rejects.toMatchObject({
      message: expect.stringMatching(/https/),
      reason: 'invalid_address',
    });
    expect(mockGuardedFetch).not.toHaveBeenCalled();
  });

  it('reads the export route with the token, and says a refused token', async () => {
    configure('https://production.example/ignored', 'lpsr_x');
    mockGuardedFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(source.fetchProductionExport()).rejects.toMatchObject({
      message: 'Production refused the read token.',
      reason: 'token_refused',
    });
    const [url, options] = mockGuardedFetch.mock.calls[0];
    expect(url).toBe('https://production.example/api/skills-source/export');
    expect(options.headers.Authorization).toBe('Bearer lpsr_x');
  });

  // The page says why in the reader's language; the message stays for logs.
  it.each([
    [
      'cannot be reached',
      () => Promise.reject(new Error('Host DNS resolution failed')),
      'unreachable',
    ],
    [
      'answers an error',
      () => Promise.resolve({ ok: false, status: 503 }),
      'production_error',
    ],
    [
      'answers something that is not JSON',
      () =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.reject(new SyntaxError('Unexpected token')),
        }),
      'unreadable',
    ],
    // The body bounded by guardedFetch: too big reads as unreadable, too
    // slow as out of reach, each saying which in the logs.
    [
      'answers more than the copy reads',
      answering(fetchError('max-size')),
      'unreadable',
      /max-size/,
    ],
    [
      'answers too slowly',
      answering(fetchError('body-timeout')),
      'unreachable',
      /timed out/,
    ],
  ])(
    'says why when production %s',
    async (_case, answer, reason, message = /./) => {
      configure('https://production.example', 'lpsr_x');
      mockGuardedFetch.mockImplementationOnce(answer);

      await expect(source.fetchProductionExport()).rejects.toMatchObject({
        reason,
        code: `SKILLS_FOLLOW_${reason.toUpperCase()}`,
        message: expect.stringMatching(message),
      });
    }
  );
});
