'use strict';

// The Emarsys provider is the whole contract with the Emarsys API v3 (ADR 0028):
// an OAuth 2.0 token from the client credentials, the folders of the Media
// Database, and the files put there. These tests stand a fake Emarsys behind
// node-fetch and check what it receives and what the provider makes of its
// answers, never how the provider is built.

jest.mock('node-fetch');
jest.mock('../../../../packages/server/utils/outbound-host.js', () => ({
  ...jest.requireActual('../../../../packages/server/utils/outbound-host.js'),
  assertOutboundHostAllowed: jest.fn().mockResolvedValue(undefined),
}));

const fetch = require('node-fetch');

const TOKEN_URL = 'https://auth.emarsys.net/oauth2/token';
const API = 'https://api.emarsys.net/api/v3';
const CLIENT_ID = 'client-123';
const CLIENT_SECRET = 'secret-456';
const ROOT_FOLDER = 4200;

function reply(status, body) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: () => 'application/json' },
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

const ok = (data) => reply(200, { replyCode: 0, replyText: 'OK', data });

/**
 * A fake Emarsys account: its folders and files, the requests it received.
 * `refuse` makes one route answer an error instead.
 */
function fakeEmarsys({
  folders = [{ id: ROOT_FOLDER, parent: 0, name: 'LePatron' }],
  files = {},
  refuse = {},
} = {}) {
  const state = { folders: [...folders], files: { ...files }, requests: [] };
  let nextId = 9000;

  fetch.mockImplementation(async (url, options = {}) => {
    const method = options.method || 'GET';
    const request = {
      method,
      url,
      headers: options.headers || {},
      body: options.body,
    };
    state.requests.push(request);
    const parsed = new URL(url);
    const route = `${method} ${parsed.origin}${parsed.pathname}`;
    if (refuse[route]) return refuse[route]();

    if (route === `POST ${TOKEN_URL}`) {
      return reply(200, {
        access_token: 'jwt-abc',
        token_type: 'Bearer',
        expires_in: 3600,
      });
    }
    if (route === `GET ${API}/folder`) {
      const parent = parsed.searchParams.get('folder');
      return ok(
        parent
          ? state.folders.filter((f) => String(f.parent) === parent)
          : state.folders
      );
    }
    if (route === `POST ${API}/folder`) {
      const { name, parent } = JSON.parse(options.body);
      const folder = { id: nextId++, parent, name };
      state.folders.push(folder);
      return ok({ id: folder.id });
    }
    if (route === `POST ${API}/file`) {
      const { filename, file, folder } = JSON.parse(options.body);
      const id = nextId++;
      // Emarsys renames what it stores: the URL is never derived from the name.
      const stored = `${id}_${filename}`;
      state.files[id] = {
        id,
        folder,
        filename: stored,
        original_name: filename,
        content: Buffer.from(file, 'base64'),
        url: `https://link.example.net/custloads/123/${stored}`,
      };
      return ok([{ id: String(id), folder: String(folder), filename: stored }]);
    }
    const fileMatch = parsed.pathname.match(/\/api\/v3\/file\/(\d+)$/);
    if (method === 'GET' && fileMatch) {
      const file = state.files[fileMatch[1]];
      if (!file) {
        return reply(404, { replyCode: 1, replyText: 'File not found' });
      }
      // What Emarsys describes of a file: everything but its bytes.
      const { content: _content, ...properties } = file;
      return ok(properties);
    }
    return reply(404, { replyCode: 1, replyText: `No route ${route}` });
  });

  return state;
}

const apiRequests = (state) =>
  state.requests.filter((r) => r.url.startsWith(API));

// Turned on by #1613 (a tech admin connects an Emarsys account)
describe.skip('Emarsys provider: credentials and folders', () => {
  let EmarsysProvider;

  beforeAll(() => {
    // Required here, not at the top of the file: the provider does not exist
    // until #1613 ships it, and a top-level require would break the suite.
    EmarsysProvider = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-provider.js');
  });

  const makeProvider = (config = {}) =>
    new EmarsysProvider({
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: CLIENT_SECRET,
      config: { clientId: CLIENT_ID, rootFolderId: ROOT_FOLDER, ...config },
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('asks the token with the client credentials grant, in HTTP Basic', async () => {
    const emarsys = fakeEmarsys();

    await makeProvider().validateCredentials();

    const tokenRequest = emarsys.requests.find((r) => r.url === TOKEN_URL);
    expect(tokenRequest.method).toBe('POST');
    const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString(
      'base64'
    );
    const headers = Object.fromEntries(
      Object.entries(tokenRequest.headers).map(([k, v]) => [k.toLowerCase(), v])
    );
    expect(headers.authorization).toBe(`Basic ${basic}`);
    expect(String(tokenRequest.body)).toContain(
      'grant_type=client_credentials'
    );
  });

  it('calls the API with the token as a Bearer', async () => {
    const emarsys = fakeEmarsys();

    await makeProvider().listFolders();

    const [call] = apiRequests(emarsys);
    const authorization = Object.entries(call.headers).find(
      ([k]) => k.toLowerCase() === 'authorization'
    )[1];
    expect(authorization).toBe('Bearer jwt-abc');
  });

  it('accepts credentials Emarsys gives a token for and lists folders with', async () => {
    fakeEmarsys();

    await expect(makeProvider().validateCredentials()).resolves.toBe(true);
  });

  it('refuses credentials Emarsys gives no token for', async () => {
    fakeEmarsys({
      refuse: {
        [`POST ${TOKEN_URL}`]: () => reply(401, { error: 'invalid_client' }),
      },
    });

    await expect(makeProvider().validateCredentials()).resolves.toBe(false);
  });

  it('lists the folders of the Media Database', async () => {
    fakeEmarsys({
      folders: [
        { id: ROOT_FOLDER, parent: 0, name: 'LePatron' },
        { id: 4300, parent: 0, name: 'Logos' },
      ],
    });

    await expect(makeProvider().listFolders()).resolves.toEqual([
      { id: ROOT_FOLDER, parent: 0, name: 'LePatron' },
      { id: 4300, parent: 0, name: 'Logos' },
    ]);
  });

  // Emarsys allows 50 token requests a minute per client: one export puts
  // dozens of images, so the token is kept until it expires.
  it('asks the token once for several calls', async () => {
    const emarsys = fakeEmarsys();
    const provider = makeProvider();

    await provider.listFolders();
    await provider.listFolders();
    await provider.validateCredentials();

    expect(emarsys.requests.filter((r) => r.url === TOKEN_URL)).toHaveLength(1);
  });
});

// Turned on by #1614 (a user exports an email to Emarsys)
describe.skip('Emarsys provider: putting an image', () => {
  let EmarsysProvider;
  let ProviderError;

  beforeAll(() => {
    EmarsysProvider = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-provider.js');
    ({
      ProviderError,
    } = require('../../../../packages/server/integration-providers/provider-error.js'));
  });

  const makeProvider = () =>
    new EmarsysProvider({
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: CLIENT_SECRET,
      config: { clientId: CLIENT_ID, rootFolderId: ROOT_FOLDER },
    });

  const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates the email's folder under the root folder, and puts the image in it", async () => {
    const emarsys = fakeEmarsys();

    await makeProvider().putImage({
      folderName: 'soldes-ete-3f9a2c',
      filename: 'hero.png',
      content: PNG,
    });

    const created = emarsys.folders.find((f) => f.name === 'soldes-ete-3f9a2c');
    expect(created.parent).toBe(ROOT_FOLDER);
    const [file] = Object.values(emarsys.files);
    expect(file.folder).toBe(created.id);
    expect(file.original_name).toBe('hero.png');
    expect(file.content.equals(PNG)).toBe(true);
  });

  it("reuses the email's folder when it already exists", async () => {
    const emarsys = fakeEmarsys({
      folders: [
        { id: ROOT_FOLDER, parent: 0, name: 'LePatron' },
        { id: 4400, parent: ROOT_FOLDER, name: 'soldes-ete-3f9a2c' },
      ],
    });

    await makeProvider().putImage({
      folderName: 'soldes-ete-3f9a2c',
      filename: 'hero.png',
      content: PNG,
    });

    expect(emarsys.folders).toHaveLength(2);
    expect(Object.values(emarsys.files)[0].folder).toBe(4400);
  });

  it('returns the file identifier and the absolute URL Emarsys gives for it', async () => {
    fakeEmarsys();

    const hosted = await makeProvider().putImage({
      folderName: 'soldes-ete-3f9a2c',
      filename: 'hero.png',
      content: PNG,
    });

    expect(hosted).toEqual({
      id: '9001',
      url: 'https://link.example.net/custloads/123/9001_hero.png',
    });
  });

  it('fails when Emarsys refuses the image', async () => {
    fakeEmarsys({
      refuse: {
        [`POST ${API}/file`]: () =>
          reply(400, { replyCode: 10001, replyText: 'File too large' }),
      },
    });

    await expect(
      makeProvider().putImage({
        folderName: 'soldes-ete-3f9a2c',
        filename: 'hero.png',
        content: PNG,
      })
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it('refuses an image over the 16 MB limit without sending it', async () => {
    const emarsys = fakeEmarsys();

    await expect(
      makeProvider().putImage({
        folderName: 'soldes-ete-3f9a2c',
        filename: 'huge.png',
        content: Buffer.alloc(16 * 1024 * 1024 + 1),
      })
    ).rejects.toBeInstanceOf(ProviderError);
    expect(
      emarsys.requests.filter((r) => r.url === `${API}/file`)
    ).toHaveLength(0);
  });
});

// Turned on by #1615 (a re-export only uploads what changed)
describe.skip('Emarsys provider: checking a file', () => {
  let EmarsysProvider;

  beforeAll(() => {
    EmarsysProvider = require('../../../../packages/server/integration-providers/asset-hosting/emarsys-provider.js');
  });

  const makeProvider = () =>
    new EmarsysProvider({
      type: 'asset_hosting',
      provider: 'emarsys',
      apiKey: CLIENT_SECRET,
      config: { clientId: CLIENT_ID, rootFolderId: ROOT_FOLDER },
    });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('finds a file still in the Media Database', async () => {
    fakeEmarsys({
      files: {
        77: {
          id: 77,
          folder: 4400,
          filename: '77_hero.png',
          original_name: 'hero.png',
          content: Buffer.from('x'),
          url: 'https://link.example.net/custloads/123/77_hero.png',
        },
      },
    });

    await expect(makeProvider().fileExists('77')).resolves.toBe(true);
  });

  it('does not find a file someone deleted', async () => {
    fakeEmarsys();

    await expect(makeProvider().fileExists('77')).resolves.toBe(false);
  });
});
