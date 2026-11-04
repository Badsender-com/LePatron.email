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
    await expect(source.fetchProductionExport()).rejects.toThrow(/https/);
    expect(mockGuardedFetch).not.toHaveBeenCalled();
  });

  it('reads the export route with the token, and says a refused token', async () => {
    configure('https://production.example/ignored', 'lpsr_x');
    mockGuardedFetch.mockResolvedValueOnce({ ok: false, status: 401 });

    await expect(source.fetchProductionExport()).rejects.toThrow(
      'Production refused the read token.'
    );
    const [url, options] = mockGuardedFetch.mock.calls[0];
    expect(url).toBe('https://production.example/api/skills-source/export');
    expect(options.headers.Authorization).toBe('Bearer lpsr_x');
  });
});
