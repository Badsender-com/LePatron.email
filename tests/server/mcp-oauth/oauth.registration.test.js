/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The three ways a client makes itself known (ADR 0012): a Client ID Metadata
// Document (Claude, ChatGPT), open Dynamic Client Registration of confidential
// clients with a secret (Microsoft 365 Copilot does not take public clients) and
// of public ones, and a client a super admin registers by hand (Copilot Studio
// in manual mode). What keeps open registration in bounds is in
// oauth.registration-safeguards.test.js.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT } = oauth;
const COPILOT_REDIRECT =
  'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect';
// The MCP clients of the client group, which its tech admin registers.
const CLIENTS = `/api/groups/${f.CLIENT_GROUP}/mcp-clients`;

describe('CIMD registration', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  it('takes a client known only by the URL of its metadata document', async () => {
    const { access_token: accessToken } = await oauth.connect(app, f.FRANK, {
      group: f.CLIENT_GROUP,
    });

    expect(accessToken).toEqual(expect.any(String));
  });

  it('refuses a redirect URI its document does not list', async () => {
    const response = await request(app)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(CIMD_CLIENT, oauth.pkce().challenge, {
          redirect_uri: 'https://attacker.example.test/callback',
        })
      );

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });

  it('refuses a document that does not name itself by its own URL', async () => {
    const url = 'https://liar.example.test/oauth/client.json';
    oauth.serveClientMetadata(url, {
      ...CIMD_CLIENT,
      client_id: 'someone-else',
    });

    const response = await request(app)
      .get('/oauth/auth')
      .query(
        oauth.authorizeQuery(
          { ...CIMD_CLIENT, client_id: url },
          oauth.pkce().challenge
        )
      );

    expect(response.status).toBe(400);
  });

  // Claude Code's document declares `http://localhost/callback` and listens
  // on a port it picks at each login (RFC 8252, 7.3).
  describe("a client that redirects to the user's own machine", () => {
    const url = 'https://assistant.example.test/oauth/cli.json';
    const authorize = (redirectUri, document = {}) => {
      oauth.serveClientMetadata(url, {
        client_id: url,
        client_name: 'A command line assistant',
        redirect_uris: [
          'http://localhost/callback',
          'http://127.0.0.1/callback',
        ],
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

    it('keeps a web client to the redirect URIs it declared', async () => {
      const response = await authorize('http://localhost:57164/callback', {
        redirect_uris: [
          'http://localhost/callback',
          'https://assistant.example.test/callback',
        ],
      });

      expect(response.status).toBe(400);
    });
  });
});

describe('DCR registration', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const register = (metadata) =>
    request(app)
      .post('/oauth/reg')
      .send({
        client_name: 'A copilot',
        redirect_uris: [COPILOT_REDIRECT],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        ...metadata,
      });

  it('registers a confidential client and hands it a secret', async () => {
    const response = await register({
      token_endpoint_auth_method: 'client_secret_post',
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      client_id: expect.any(String),
      client_secret: expect.any(String),
      client_name: 'A copilot',
      redirect_uris: [COPILOT_REDIRECT],
    });
  });

  it('registers a public client without a secret', async () => {
    const response = await register({ token_endpoint_auth_method: 'none' });

    expect(response.status).toBe(201);
    expect(response.body.client_secret).toBeUndefined();
  });

  it('makes a confidential client prove its secret at the token endpoint', async () => {
    const { body: client } = await register({
      token_endpoint_auth_method: 'client_secret_post',
    });

    const withSecret = await oauth.connect(app, f.FRANK, {
      client,
      group: f.CLIENT_GROUP,
      secret: client.client_secret,
    });
    const withoutSecret = await oauth.connect(app, f.FRANK, {
      client,
      group: f.CLIENT_GROUP,
      secret: 'wrong',
    });

    expect(withSecret.access_token).toEqual(expect.any(String));
    expect(withoutSecret.error).toBe('invalid_client');
  });

  it('refuses a registration without a redirect URI', async () => {
    const response = await register({ redirect_uris: [] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_redirect_uri');
  });
});

describe('pre-registered clients', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const create = (userId) =>
    oauth
      .signIn(app, userId)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });

  it('lets a super admin register a client, and shows its secret once', async () => {
    const created = await create(f.ALICE);
    const listed = await oauth.signIn(app, f.ALICE).get(CLIENTS);

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      clientId: expect.any(String),
      clientSecret: expect.any(String),
    });
    expect(listed.body.items).toEqual([
      expect.objectContaining({
        clientId: created.body.clientId,
        name: 'Copilot Studio',
      }),
    ]);
    expect(JSON.stringify(listed.body)).not.toContain(
      created.body.clientSecret
    );
  });

  it("lets the company's tech admin register one", async () => {
    expect((await create(f.TESS)).status).toBe(201);
  });

  it.each([
    ['a company admin', f.ERIN],
    ['a regular user', f.FRANK],
  ])('refuses %s', async (_role, userId) => {
    expect((await create(userId)).status).toBe(403);
  });

  it('connects with the static id and secret', async () => {
    const { body } = await create(f.ALICE);
    const client = {
      client_id: body.clientId,
      redirect_uris: [COPILOT_REDIRECT],
    };

    const tokens = await oauth.connect(app, f.FRANK, {
      client,
      group: f.CLIENT_GROUP,
      secret: body.clientSecret,
    });

    expect(tokens.access_token).toEqual(expect.any(String));
  });

  it('stops a deleted client at the token endpoint', async () => {
    const { body } = await create(f.ALICE);
    const client = {
      client_id: body.clientId,
      redirect_uris: [COPILOT_REDIRECT],
    };
    const tokens = await oauth.connect(app, f.FRANK, {
      client,
      group: f.CLIENT_GROUP,
      secret: body.clientSecret,
    });

    await oauth.signIn(app, f.ALICE).delete(`${CLIENTS}/${body.clientId}`);
    const refreshed = await request(app)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: body.clientId,
        client_secret: body.clientSecret,
      });

    expect(refreshed.body.error).toBe('invalid_client');
  });
});

// Open registration would otherwise keep every client that ever registered.
describe('how long a client is kept', () => {
  const DAY = 24 * 3600;
  let app;
  let upsert;
  beforeEach(() => {
    app = oauth.createApp();
    upsert = jest.spyOn(app.provider.Client.adapter, 'upsert');
  });

  const register = () =>
    request(app)
      .post('/oauth/reg')
      .send({
        client_name: 'A copilot',
        redirect_uris: [COPILOT_REDIRECT],
        token_endpoint_auth_method: 'client_secret_post',
      });
  const keptFor = (clientId) =>
    upsert.mock.calls
      .filter(([id]) => id === clientId)
      .map(([, , seconds]) => seconds);

  it('keeps a client that registered for a day', async () => {
    const { body: client } = await register();

    expect(keptFor(client.client_id)).toEqual([undefined, DAY]);
  });

  it('keeps it as long as a grant once it connects someone', async () => {
    const { body: client } = await register();

    await oauth.connect(app, f.FRANK, {
      client,
      group: f.CLIENT_GROUP,
      secret: client.client_secret,
    });

    expect(keptFor(client.client_id)).toEqual([undefined, DAY, 90 * DAY]);
  });

  it('keeps a client a super admin registered until it is deleted', async () => {
    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });

    await oauth.connect(app, f.FRANK, {
      client: { client_id: body.clientId, redirect_uris: [COPILOT_REDIRECT] },
      group: f.CLIENT_GROUP,
      secret: body.clientSecret,
    });

    expect(keptFor(body.clientId)).toEqual([]);
  });
});

describe('registering a client by hand', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const create = (fields) =>
    oauth
      .signIn(app, f.ALICE)
      .post(CLIENTS)
      .send({
        name: 'Copilot Studio',
        redirectUris: [COPILOT_REDIRECT],
        ...fields,
      });

  it.each([
    ['no name', { name: ' ' }],
    ['no redirect URI', { redirectUris: [] }],
    [
      'a redirect URI in plain HTTP',
      { redirectUris: ['http://copilot.example.test/cb'] },
    ],
    ['a redirect URI that is not a URL', { redirectUris: ['callback'] }],
    ['an unknown authentication method', { tokenEndpointAuthMethod: 'none' }],
  ])('refuses %s', async (_case, fields) => {
    const response = await create(fields);

    expect(response.status).toBe(400);
    expect((await oauth.signIn(app, f.ALICE).get(CLIENTS)).body.items).toEqual(
      []
    );
  });

  it('takes a loopback redirect URI and the basic authentication method', async () => {
    const response = await create({
      redirectUris: ['http://localhost:33418/callback'],
      tokenEndpointAuthMethod: 'client_secret_basic',
    });

    expect(response.status).toBe(201);
    expect(response.body.tokenEndpointAuthMethod).toBe('client_secret_basic');
  });

  it('asks who is there', async () => {
    const response = await request(app).get(CLIENTS);

    expect(response.status).toBe(401);
  });

  it('answers a client it does not know', async () => {
    const response = await oauth
      .signIn(app, f.ALICE)
      .delete(`${CLIENTS}/lepatron-unknown`);

    expect(response.status).toBe(404);
  });
});

describe('what the consent page says of a client', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const detailsFor = async (client) => {
    const agent = oauth.signIn(app, f.FRANK);
    const uid = await oauth.startConsent(agent, client, oauth.pkce().challenge);
    return (await agent.get(`/oauth/consent/${uid}/details`)).body;
  };

  it('says a client that registered itself is only what it claims', async () => {
    const { body: client } = await request(app)
      .post('/oauth/reg')
      .send({
        client_name: 'Copilot Studio',
        redirect_uris: [COPILOT_REDIRECT],
        token_endpoint_auth_method: 'none',
      });

    expect((await detailsFor(client)).client).toEqual({
      name: 'Copilot Studio',
      registration: 'dynamic',
    });
    expect(client.registration_access_token).toBeUndefined();
  });

  it('says which company registered a client', async () => {
    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });

    const details = await detailsFor({
      client_id: body.clientId,
      redirect_uris: [COPILOT_REDIRECT],
    });

    expect(details.client).toEqual({
      name: 'Copilot Studio',
      registration: 'preRegistered',
      company: 'A client',
    });
  });

  it('shows a redirect URI with no host whole', async () => {
    const { body: client } = await request(app)
      .post('/oauth/reg')
      .send({
        client_name: 'A desktop app',
        application_type: 'native',
        redirect_uris: ['com.example.app:/callback'],
        token_endpoint_auth_method: 'none',
      });

    expect((await detailsFor(client)).redirectHost).toBe(
      'com.example.app:/callback'
    );
  });
});

describe('deleting a client registered by hand', () => {
  it('cuts the access tokens it holds at once', async () => {
    const app = oauth.createApp();
    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });
    const { access_token: accessToken } = await oauth.connect(app, f.FRANK, {
      client: { client_id: body.clientId, redirect_uris: [COPILOT_REDIRECT] },
      group: f.CLIENT_GROUP,
      secret: body.clientSecret,
    });
    const before = await oauth.callMcp(app, accessToken, 'initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'copilot', version: '1' },
    });

    await oauth.signIn(app, f.ALICE).delete(`${CLIENTS}/${body.clientId}`);
    const after = await oauth.callMcp(app, accessToken);

    expect(before.status).toBe(200);
    expect(after.status).toBe(401);
    expect(
      (await oauth.signIn(app, f.FRANK).get('/api/connected-applications')).body
        .items
    ).toEqual([]);
  });
});

describe('a company deleted', () => {
  // Nothing else would ever delete them, their secrets with them.
  it('takes the clients it registered with it', async () => {
    const app = oauth.createApp();
    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });
    const {
      forgetCompanyClients,
    } = require('../../../packages/server/mcp/mcp-clients.js');

    await forgetCompanyClients(f.CLIENT_GROUP);

    const listed = await oauth.signIn(app, f.ALICE).get(CLIENTS);
    const token = await request(app)
      .post('/oauth/token')
      .type('form')
      .auth(body.clientId, body.clientSecret)
      .send({ grant_type: 'client_credentials' });
    expect(listed.body.items).toEqual([]);
    expect(token.body.error).toBe('invalid_client');
  });
});

describe('a client registered by a company', () => {
  let app;
  let client;
  beforeEach(async () => {
    app = oauth.createApp();
    const { body } = await oauth
      .signIn(app, f.TESS)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });
    client = body;
  });

  const asClient = () => ({
    client_id: client.clientId,
    redirect_uris: [COPILOT_REDIRECT],
  });
  const otherClients = `/api/groups/${f.OTHER_GROUP}/mcp-clients`;

  it("is listed in its company's settings, not in another's", async () => {
    const own = await oauth.signIn(app, f.TESS).get(CLIENTS);
    const other = await oauth.signIn(app, f.ALICE).get(otherClients);

    expect(own.body.items).toEqual([
      expect.objectContaining({ clientId: client.clientId }),
    ]);
    expect(other.body.items).toEqual([]);
  });

  it("refuses a tech admin another company's clients", async () => {
    const listed = await oauth.signIn(app, f.TESS).get(otherClients);
    const deleted = await oauth
      .signIn(app, f.ALICE)
      .delete(`${otherClients}/${client.clientId}`);

    expect(listed.status).toBe(403);
    expect(deleted.status).toBe(404);
  });

  it('refuses the consent of a user of another company', async () => {
    const agent = oauth.signIn(app, f.OTTO);
    const uid = await oauth.startConsent(
      agent,
      asClient(),
      oauth.pkce().challenge
    );

    const details = await agent.get(`/oauth/consent/${uid}/details`);

    expect(details.status).toBe(403);
    expect(details.body.code).toBe('client_of_another_company');
  });

  it('offers a super admin its company alone', async () => {
    const agent = oauth.signIn(app, f.ALICE);
    const uid = await oauth.startConsent(
      agent,
      asClient(),
      oauth.pkce().challenge
    );

    const details = await agent.get(`/oauth/consent/${uid}/details`);
    const consent = await agent
      .post(`/oauth/consent/${uid}/consent`)
      .send({ groupId: f.OTHER_GROUP });

    expect(details.body.groups).toEqual([
      { id: f.CLIENT_GROUP, name: 'A client' },
    ]);
    expect(consent.status).toBe(403);
  });
});
