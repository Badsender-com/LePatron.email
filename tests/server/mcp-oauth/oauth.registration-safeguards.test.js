'use strict';

// Open Dynamic Client Registration lets anyone register a client (ADR 0012):
// what keeps it in bounds. The redirect URIs it takes, the pace of the
// registrations, what the consent shows of a client that registered itself,
// and the clients it forgets.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const COPILOT_REDIRECT =
  'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect';

// Turned on by #1307 (ChatGPT and Microsoft clients)
describe.skip('DCR safeguards', () => {
  const DAY_MS = 24 * 3600 * 1000;
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  const register = (metadata) =>
    request(app)
      .post('/oauth/reg')
      .send({
        client_name: 'A copilot',
        redirect_uris: [COPILOT_REDIRECT],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        ...metadata,
      });
  const authorize = (client) =>
    request(app)
      .get('/oauth/auth')
      .query(oauth.authorizeQuery(client, oauth.pkce().challenge));
  const later = (ms) => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(now + ms);
  };

  it.each([
    ['in HTTPS', 'https://assistant.example.test/oauth/callback'],
    ['in HTTP on the loopback address', 'http://127.0.0.1:33418/callback'],
  ])('takes a redirect URI %s', async (_case, uri) => {
    const response = await register({ redirect_uris: [uri] });

    expect(response.status).toBe(201);
  });

  it.each([
    ['in HTTP on another host', 'http://assistant.example.test/callback'],
    ['in a scheme of its own', 'com.example.app:/callback'],
  ])('refuses a redirect URI %s', async (_case, uri) => {
    const response = await register({ redirect_uris: [uri] });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_redirect_uri');
  });

  it('slows down registrations sent one after another', async () => {
    const statuses = [];
    for (let attempt = 0; attempt < 100; attempt += 1) {
      statuses.push((await register()).status);
    }

    expect(statuses[0]).toBe(201);
    expect(statuses).toContain(429);
  });

  it('tells the user at consent that the application registered itself, and where it sends them back', async () => {
    const { body: client } = await register();
    const agent = oauth.signIn(app, f.FRANK);
    const uid = await oauth.startConsent(agent, client, oauth.pkce().challenge);

    const { body } = await agent.get(`/api/oauth/interactions/${uid}`);

    expect(body.client).toMatchObject({
      name: 'A copilot',
      registration: 'dynamic',
    });
    expect(body.redirectHost).toBe(new URL(COPILOT_REDIRECT).host);
  });

  it('forgets a client that connected nobody within a day', async () => {
    const { body: client } = await register();

    later(DAY_MS + 1000);
    const response = await authorize(client);

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });

  it('keeps a client that connected someone as long as the connection', async () => {
    const { body: client } = await register();
    await oauth.connect(app, f.FRANK, { client, group: f.CLIENT_GROUP });

    later(DAY_MS + 1000);
    const response = await authorize(client);

    expect(response.status).toBe(303);
  });
});
