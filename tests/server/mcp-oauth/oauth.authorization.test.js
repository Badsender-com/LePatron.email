/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Connecting an application (ADR 0012): the user logs in to LePatron as usual,
// sees which application asks for what, binds the connection to one group (a
// super admin picks it), and the application gets a code.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const { CIMD_CLIENT, ISSUER } = oauth;

describe('authorization and consent', () => {
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

    const response = await request(app).get(`/oauth/consent/${uid}/details`);

    expect(response.status).toBe(401);
    expect(response.body.code).toBe(ERROR_CODES.MCP_CONSENT_SIGN_IN_REQUIRED);
  });

  it('names the application, what it asks for and the user’s group', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const { status, body } = await agent.get(`/oauth/consent/${uid}/details`);

    expect(status).toBe(200);
    expect(body).toEqual({
      client: {
        name: 'An assistant',
        registration: 'metadataDocument',
        host: 'assistant.example.test',
      },
      redirectHost: 'assistant.example.test',
      scopes: ['mcp:read'],
      groups: [{ id: f.CLIENT_GROUP, name: 'A client' }],
      account: { name: 'Frank', email: 'frank@example.test' },
    });
  });

  it('offers a super admin every group with MCP access', async () => {
    const { agent, uid } = await consentFor(f.ALICE);

    const { body } = await agent.get(`/oauth/consent/${uid}/details`);

    expect(body.groups.map((group) => group.id).sort()).toEqual(
      [f.PLATFORM_GROUP, f.CLIENT_GROUP, f.OTHER_GROUP].sort()
    );
  });

  it('stops an account LePatron does not know, as the bootstrap account', async () => {
    const { uid } = await consentFor(f.FRANK);

    // The bootstrap account's id has no document.
    const response = await oauth
      .signIn(app, '576b90a441ceadc005124896')
      .get(`/oauth/consent/${uid}/details`);

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('account_cannot_connect');
  });

  it('stops a user whose group has no MCP access', async () => {
    const { agent, uid } = await consentFor(f.NINA);

    const response = await agent.get(`/oauth/consent/${uid}/details`);

    expect(response.status).toBe(403);
    expect(response.body.message).toMatch(/MCP access/i);
    expect(response.body.code).toBe(ERROR_CODES.MCP_CONSENT_NO_ACCESS);
  });

  it('hands the application a code, its state and the issuer', async () => {
    const { agent, uid } = await consentFor(f.FRANK);
    const consent = await agent
      .post(`/oauth/consent/${uid}/consent`)
      .send({ groupId: f.CLIENT_GROUP });

    const back = await oauth.followToClient(agent, consent.body.redirectTo);

    expect(back.origin + back.pathname).toBe(CIMD_CLIENT.redirect_uris[0]);
    expect(back.searchParams.get('code')).toEqual(expect.any(String));
    expect(back.searchParams.get('state')).toBe('state-1');
    expect(back.searchParams.get('iss')).toBe(ISSUER);
  });

  // A consent link sent to someone else: the victim's consent must not
  // reach the browser of whoever started the authorization.
  it('answers nothing to a browser that did not start the authorization', async () => {
    const attacker = oauth.signIn(app, f.OTTO);
    const uid = await oauth.startConsent(
      attacker,
      CIMD_CLIENT,
      oauth.pkce().challenge
    );
    const victim = oauth.signIn(app, f.FRANK);

    const details = await victim.get(`/oauth/consent/${uid}/details`);
    const consent = await victim
      .post(`/oauth/consent/${uid}/consent`)
      .send({ groupId: f.CLIENT_GROUP });

    expect(details.status).toBe(404);
    expect(consent.status).toBe(404);
  });

  it('refuses to bind a user to a group they are not in', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const consent = await agent
      .post(`/oauth/consent/${uid}/consent`)
      .send({ groupId: f.OTHER_GROUP });

    expect(consent.status).toBe(403);
  });

  it('refuses to bind a super admin to a group without MCP access', async () => {
    const { agent, uid } = await consentFor(f.ALICE);

    const consent = await agent
      .post(`/oauth/consent/${uid}/consent`)
      .send({ groupId: f.UNSUBSCRIBED_GROUP });

    expect(consent.status).toBe(403);
  });

  it('tells the application when the user declines', async () => {
    const { agent, uid } = await consentFor(f.FRANK);

    const denied = await agent.post(`/oauth/consent/${uid}/deny`);
    const back = await oauth.followToClient(agent, denied.body.redirectTo);

    expect(back.searchParams.get('error')).toBe('access_denied');
    expect(back.searchParams.get('code')).toBeNull();
  });

  // The application waits for an answer: it gets one whatever stops the
  // user from connecting.
  it.each([
    ['a user whose company has no MCP access', f.NINA],
    ['the bootstrap account', '576b90a441ceadc005124896'],
  ])('lets %s decline', async (_who, userId) => {
    const agent = oauth.signIn(app, userId);
    const uid = await oauth.startConsent(
      agent,
      CIMD_CLIENT,
      oauth.pkce().challenge
    );

    const denied = await agent.post(`/oauth/consent/${uid}/deny`);
    const back = await oauth.followToClient(agent, denied.body.redirectTo);

    expect(denied.status).toBe(200);
    expect(back.searchParams.get('error')).toBe('access_denied');
  });

  it('answers nothing to a decline from a browser that did not start the authorization', async () => {
    const { uid } = await consentFor(f.OTTO);

    const denied = await oauth
      .signIn(app, f.FRANK)
      .post(`/oauth/consent/${uid}/deny`);

    expect(denied.status).toBe(404);
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

// The consent screen asks for a session like any page of the app, so the
// two-factor step of ADR 0008 comes before it: a password alone never consents.
// Turned on by #1306 (OAuth connection end to end)
describe.skip('two-factor authentication before the consent', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
    oauth.update(app, 'groups', f.CLIENT_GROUP, { requireTwoFactor: true });
  });

  const beforeCode = async (userId) => {
    const agent = oauth.signInBeforeCode(app, userId);
    const uid = await oauth.startConsent(
      agent,
      CIMD_CLIENT,
      oauth.pkce().challenge
    );
    return { agent, uid };
  };

  describe.each([
    ['a member of a company that requires it', f.FRANK],
    ['a super admin', f.ALICE],
  ])('%s, between the password and the code', (_who, userId) => {
    it('is shown no consent', async () => {
      const { agent, uid } = await beforeCode(userId);

      const response = await agent.get(`/api/oauth/interactions/${uid}`);

      expect(response.status).toBe(401);
    });

    it('cannot consent', async () => {
      const { agent, uid } = await beforeCode(userId);

      const consent = await agent
        .post(`/api/oauth/interactions/${uid}/consent`)
        .send({ groupId: f.CLIENT_GROUP });

      expect(consent.status).toBe(401);
      expect(consent.body.redirectTo).toBeUndefined();
    });
  });

  it('shows the consent once the code is checked', async () => {
    const agent = oauth.signIn(app, f.FRANK);
    const uid = await oauth.startConsent(
      agent,
      CIMD_CLIENT,
      oauth.pkce().challenge
    );

    const response = await agent.get(`/api/oauth/interactions/${uid}`);

    expect(response.status).toBe(200);
  });
});
