'use strict';

// Where the Emarsys provider sends its calls: the Emarsys API, or the fake
// Emarsys of a developer's machine, and never anywhere else.
const {
  emarsysEndpoints,
} = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-endpoints.js');

describe('the Emarsys endpoints', () => {
  it('are the Emarsys API by default', () => {
    expect(emarsysEndpoints({})).toEqual({
      tokenUrl: 'https://auth.emarsys.net/oauth2/token',
      apiUrl: 'https://api.emarsys.net/api/v3',
      isDevFake: false,
    });
  });

  it.each([
    'http://localhost:3800',
    'http://127.0.0.1:3800/',
    'http://[::1]:3800',
  ])('are the fake Emarsys at %s', (emarsysFakeUrl) => {
    const base = emarsysFakeUrl.replace(/\/$/, '');
    expect(emarsysEndpoints({ emarsysFakeUrl })).toEqual({
      tokenUrl: `${base}/oauth2/token`,
      apiUrl: `${base}/api/v3`,
      isDevFake: true,
    });
  });

  // The setting only ever points at the developer's own machine: elsewhere,
  // the credentials of the integrations would leave for an unknown host.
  it.each([
    'https://emarsys.example.com',
    'http://10.0.0.12:3800',
    'http://localhost.example.com:3800',
    'file:///etc/passwd',
    'not a url',
  ])('refuse a fake Emarsys at %s', (emarsysFakeUrl) => {
    expect(() => emarsysEndpoints({ emarsysFakeUrl })).toThrow(
      /emarsysFakeUrl/
    );
  });
});

// Turned on by the setting, on a developer's machine.
describe('the Emarsys provider with the fake Emarsys', () => {
  const config = require('../../../../packages/server/node.config.js');
  let fetch;
  let EmarsysProvider;
  let fakeUrl;

  beforeAll(() => {
    fakeUrl = config.emarsysFakeUrl;
    jest.resetModules();
    jest.doMock('node-fetch', () => jest.fn());
    fetch = require('node-fetch');
    EmarsysProvider = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-provider.js');
  });

  afterAll(() => {
    config.emarsysFakeUrl = fakeUrl;
  });

  it('sends its calls to the fake Emarsys', async () => {
    require('../../../../packages/server/node.config.js').emarsysFakeUrl =
      'http://localhost:3800';
    const reply = (body) => ({
      status: 200,
      ok: true,
      headers: { get: () => 'application/json' },
      json: () => Promise.resolve(body),
    });
    fetch.mockImplementation(async (url) =>
      url.endsWith('/oauth2/token')
        ? reply({ access_token: 'jwt', expires_in: 3600 })
        : reply({ replyCode: 0, data: [] })
    );

    const provider = new EmarsysProvider({
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: 'fake-secret',
      config: { clientId: 'fake-client', rootFolderId: 1000 },
    });
    await provider.listFolders();

    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      'http://localhost:3800/oauth2/token',
      'http://localhost:3800/api/v3/folder',
    ]);
  });
});
