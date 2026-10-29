'use strict';

// The three ways a client makes itself known (ADR 0012): a Client ID Metadata
// Document (Claude, ChatGPT), open Dynamic Client Registration with a secret
// (Microsoft 365 Copilot does not take public clients), and a client a super
// admin registers by hand (Copilot Studio in manual mode).

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT } = oauth;
const COPILOT_REDIRECT =
  'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect';

// Turned on by #1306 (OAuth connection end to end)
describe.skip('CIMD registration', () => {
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
});

// Turned on by #1307 (ChatGPT and Microsoft clients)
describe.skip('DCR registration', () => {
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

// Turned on by #1307 (ChatGPT and Microsoft clients)
describe.skip('pre-registered clients', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const create = (userId) =>
    oauth
      .signIn(app, userId)
      .post('/api/mcp-clients')
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });

  it('lets a super admin register a client, and shows its secret once', async () => {
    const created = await create(f.ALICE);
    const listed = await oauth.signIn(app, f.ALICE).get('/api/mcp-clients');

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

  it.each([
    ['company admin', f.ERIN],
    ['tech admin', f.TESS],
  ])('refuses a %s', async (_role, userId) => {
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

    await oauth
      .signIn(app, f.ALICE)
      .delete(`/api/mcp-clients/${body.clientId}`);
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
