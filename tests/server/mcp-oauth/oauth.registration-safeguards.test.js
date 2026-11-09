/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
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

describe('DCR safeguards', () => {
  const DAY_MS = 24 * 3600 * 1000;
  // Past the clock tolerance the authorization server allows (15 seconds).
  const A_DAY_LATER = DAY_MS + 60 * 1000;
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });
  afterEach(() => {
    oauth.restoreClock();
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
    // A hundred an hour from one address, then none.
    for (let attempt = 0; attempt < 101; attempt += 1) {
      // eslint-disable-next-line no-await-in-loop
      statuses.push((await register()).status);
    }

    expect(statuses.slice(0, 100)).toEqual(Array(100).fill(201));
    expect(statuses[100]).toBe(429);
  });

  it('tells the user at consent that the application registered itself, and where it sends them back', async () => {
    const { body: client } = await register();
    const agent = oauth.signIn(app, f.FRANK);
    const uid = await oauth.startConsent(agent, client, oauth.pkce().challenge);

    const { body } = await agent.get(`/oauth/consent/${uid}/details`);

    expect(body.client).toMatchObject({
      name: 'A copilot',
      registration: 'dynamic',
    });
    expect(body.redirectHost).toBe(new URL(COPILOT_REDIRECT).host);
  });

  it('forgets a client that connected nobody within a day', async () => {
    const { body: client } = await register();

    oauth.later(A_DAY_LATER);
    const response = await authorize(client);

    expect(response.status).toBe(400);
    expect(response.headers.location).toBeUndefined();
  });

  it('keeps a client that connected someone as long as the connection', async () => {
    const { body: client } = await register();
    await oauth.connect(app, f.FRANK, { client, group: f.CLIENT_GROUP });

    oauth.later(A_DAY_LATER);
    const response = await authorize(client);

    expect(response.status).toBe(303);
  });
});
