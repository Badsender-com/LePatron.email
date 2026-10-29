'use strict';

// Connecting an application (ADR 0012): the user logs in to LePatron as usual,
// sees which application asks for what, binds the connection to one group (a
// super admin picks it), and the application gets a code.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT, ISSUER } = oauth;

// Turned on by #1306 (OAuth connection end to end)
describe.skip('authorization and consent', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const consentFor = async (userId, overrides) => {
    const agent = oauth.signIn(app, userId);
    const uid = await oauth.startConsent(
      agent,
      CIMD_CLIENT,
      oauth.pkce().challenge,
      overrides
    );
    return { agent, uid };
  };

  it('sends the browser to the consent page', async () => {
    const response = await request(app)
      .get('/oauth/auth')
      .query(oauth.authorizeQuery(CIMD_CLIENT, oauth.pkce().challenge));

    expect(response.status).toBe(303);
    expect(response.headers.location).toMatch(/\/oauth\/consent\/[\w-]+$/);
  });

  it('asks a visitor without a session to log in first', async () => {
    const { uid } = await consentFor(f.FRANK);

    const response = await request(app).get(`/api/oauth/interactions/${uid}`);

    expect(response.status).toBe(401);
  });

  it('names the application, what it asks for and the user’s group', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const { status, body } = await agent.get(`/api/oauth/interactions/${uid}`);

    expect(status).toBe(200);
    expect(body).toEqual({
      client: { name: 'An assistant' },
      scopes: ['mcp:read'],
      groups: [{ id: f.CLIENT_GROUP, name: 'A client' }],
    });
  });

  it('offers a super admin every group with MCP access', async () => {
    const { agent, uid } = await consentFor(f.ALICE);

    const { body } = await agent.get(`/api/oauth/interactions/${uid}`);

    expect(body.groups.map((group) => group.id).sort()).toEqual(
      [f.PLATFORM_GROUP, f.CLIENT_GROUP, f.OTHER_GROUP].sort()
    );
  });

  it('stops a user whose group has no MCP access', async () => {
    const { agent, uid } = await consentFor(f.NINA);

    const response = await agent.get(`/api/oauth/interactions/${uid}`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/MCP access/i);
  });

  it('hands the application a code, its state and the issuer', async () => {
    const { agent, uid } = await consentFor(f.FRANK);
    const consent = await agent
      .post(`/api/oauth/interactions/${uid}/consent`)
      .send({ groupId: f.CLIENT_GROUP });

    const back = await oauth.followToClient(agent, consent.body.redirectTo);

    expect(back.origin + back.pathname).toBe(CIMD_CLIENT.redirect_uris[0]);
    expect(back.searchParams.get('code')).toEqual(expect.any(String));
    expect(back.searchParams.get('state')).toBe('state-1');
    expect(back.searchParams.get('iss')).toBe(ISSUER);
  });

  it('refuses to bind a user to a group they are not in', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const consent = await agent
      .post(`/api/oauth/interactions/${uid}/consent`)
      .send({ groupId: f.OTHER_GROUP });

    expect(consent.status).toBe(403);
  });

  it('refuses to bind a super admin to a group without MCP access', async () => {
    const { agent, uid } = await consentFor(f.ALICE);

    const consent = await agent
      .post(`/api/oauth/interactions/${uid}/consent`)
      .send({ groupId: f.UNSUBSCRIBED_GROUP });

    expect(consent.status).toBe(403);
  });

  it('tells the application when the user declines', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const denied = await agent.post(`/api/oauth/interactions/${uid}/deny`);
    const back = await oauth.followToClient(agent, denied.body.redirectTo);

    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('code')).toBeNull();
  });

  describe('what the authorization request must carry', () => {
    const authorize = (overrides) =>
      request(app)
        .get('/oauth/auth')
        .query(
          oauth.authorizeQuery(CIMD_CLIENT, oauth.pkce().challenge, overrides)
        );
    const errorOf = (response) =>
      new URL(response.headers.location).searchParams.get('error');

    it('a PKCE challenge', async () => {
      const response = await authorize({ code_challenge: undefined });

      expect(errorOf(response)).toBe('invalid_request');
    });

    it('the S256 method, not plain', async () => {
      const response = await authorize({ code_challenge_method: 'plain' });

      expect(errorOf(response)).toBe('invalid_request');
    });

    it('the MCP endpoint as its resource, and no other', async () => {
      const response = await authorize({
        resource: 'https://elsewhere.example.test/mcp',
      });

      expect(errorOf(response)).toBe('invalid_target');
    });

    it('a scope LePatron offers', async () => {
      const response = await authorize({ scope: 'mcp:write' });

      expect(errorOf(response)).toBe('invalid_scope');
    });
  });
});
