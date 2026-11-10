/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The redirect URIs of the clients (ADR 0012, and the MCP specification:
// "MUST be either localhost or use HTTPS"), as the authorization server
// keeps them for a client known by its metadata document and for one that
// registers itself, with what the assistants actually send. The shape of a
// redirect URI, and the refusals of open registration, are in
// oauth.registration-safeguards.test.js.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

// Claude Code's document declares `http://localhost/callback` and listens
// on a port it picks at each login (RFC 8252, 7.3).
describe("a client known by its document that redirects to the user's own machine", () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const url = 'https://assistant.example.test/oauth/cli.json';
  const authorize = (redirectUri, document = {}) => {
    oauth.serveClientMetadata(url, {
      client_id: url,
      client_name: 'A command line assistant',
      redirect_uris: ['http://localhost/callback', 'http://127.0.0.1/callback'],
      grant_types: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_method: 'none',
      ...document,
    });
    return oauth
      .signIn(app, f.FRANK)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(
          { client_id: url, redirect_uris: [redirectUri] },
          oauth.pkce().challenge
        )
      );
  };

  it.each([
    'http://localhost:57164/callback',
    'http://127.0.0.1:41000/callback',
  ])('lets it come back on any port: %s', async (redirectUri) => {
    const response = await authorize(redirectUri);

    expect(response.status).toBe(303);
    expect(response.headers.location).toMatch(/\/oauth\/consent\//);
  });

  it('keeps the path it declared', async () => {
    const response = await authorize('http://localhost:57164/elsewhere');

    expect(response.status).toBe(400);
  });

  it('lets it come back on any port when it also redirects in HTTPS', async () => {
    const response = await authorize('http://localhost:57164/callback', {
      redirect_uris: [
        'http://localhost/callback',
        'https://assistant.example.test/callback',
      ],
    });

    expect(response.status).toBe(303);
  });

  it('takes it without the redirect URIs that are refused', async () => {
    const response = await authorize('http://localhost:57164/callback', {
      redirect_uris: ['http://localhost/callback', 'com.example.app:/callback'],
    });

    expect(response.status).toBe(303);
  });

  it('refuses a document whose redirect URIs are all refused', async () => {
    const response = await authorize('http://assistant.example.test/cb', {
      redirect_uris: ['http://assistant.example.test/cb'],
    });

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });
});

// Where a client that registers itself may be sent back (ADR 0012, and the
// MCP specification: "MUST be either localhost or use HTTPS"), with what the
// assistants actually send.
describe('the redirect URIs a client registers', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const register = (metadata) =>
    request(app)
      .post('/oauth/reg')
      .send({
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        ...metadata,
      });
  const authorize = (clientId, redirectUri) =>
    oauth
      .signIn(app, f.FRANK)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(
          { client_id: clientId, redirect_uris: [redirectUri] },
          oauth.pkce().challenge
        )
      );

  it("keeps Cursor's loopback and HTTPS redirects, without its own scheme", async () => {
    const response = await register({
      client_name: 'Cursor',
      redirect_uris: [
        'http://localhost:8787/callback',
        'https://www.cursor.com/agents/mcp/oauth/callback',
        'cursor://anysphere.cursor-mcp/oauth/callback',
      ],
    });

    expect(response.status).toBe(201);
    expect(response.body.redirect_uris).toEqual([
      'http://localhost:8787/callback',
      'https://www.cursor.com/agents/mcp/oauth/callback',
    ]);
    expect(response.body.application_type).toBe('native');
    const tokens = await oauth.connect(app, f.FRANK, {
      client: {
        client_id: response.body.client_id,
        redirect_uris: ['http://localhost:8787/callback'],
      },
      group: f.CLIENT_GROUP,
    });
    expect(tokens.access_token).toEqual(expect.any(String));
  });

  it('lets VS Code come back on the loopback port it picks', async () => {
    const { status, body } = await register({
      client_name: 'Visual Studio Code',
      application_type: 'native',
      redirect_uris: ['https://vscode.dev/redirect', 'http://127.0.0.1:33418/'],
    });

    const response = await authorize(body.client_id, 'http://127.0.0.1:50123/');

    expect(status).toBe(201);
    expect(body.redirect_uris).toEqual([
      'https://vscode.dev/redirect',
      'http://127.0.0.1:33418/',
    ]);
    expect(response.status).toBe(303);
  });

  it('keeps claude.ai a web client, to the redirect URI it registered', async () => {
    const { status, body } = await register({
      client_name: 'Claude',
      redirect_uris: ['https://claude.ai/api/mcp/auth_callback'],
    });

    expect(status).toBe(201);
    expect(body.application_type).toBe('web');
    expect(
      (await authorize(body.client_id, body.redirect_uris[0])).status
    ).toBe(303);
  });

  it.each([
    ['in plain HTTP to another host', 'web', 'http://evil.example.test/cb'],
    ['in a scheme of its own', 'native', 'com.example.app:/callback'],
    ['in HTTPS with a fragment', 'web', 'https://assistant.example.test/cb#a'],
  ])(
    'refuses a client whose only redirect URI is %s',
    async (_case, type, uri) => {
      const response = await register({
        client_name: 'An app',
        application_type: type,
        redirect_uris: [uri],
      });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('invalid_redirect_uri');
    }
  );
});
