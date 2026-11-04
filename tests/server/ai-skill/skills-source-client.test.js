'use strict';

// How a copy reaches production (ADR 0019, #1425): from its configuration
// only, over https, and the page shows production's origin, nothing more.

const mockConfig = { skillsSource: {} };
jest.mock('../../../packages/server/node.config.js', () => mockConfig);
const mockGuardedFetch = jest.fn();
jest.mock(
  '../../../packages/server/integration-providers/provider-http.js',
  () => ({
    guardedFetch: (...args) => mockGuardedFetch(...args),
  })
);

const source = require('../../../packages/server/ai-skill/services/skills-source-client.js');

const configure = (url, token) => {
  mockConfig.skillsSource = { url, token };
};

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
  ])('says why when production %s', async (_case, answer, reason) => {
    configure('https://production.example', 'lpsr_x');
    mockGuardedFetch.mockImplementationOnce(answer);

    await expect(source.fetchProductionExport()).rejects.toMatchObject({
      reason,
    });
  });
});
