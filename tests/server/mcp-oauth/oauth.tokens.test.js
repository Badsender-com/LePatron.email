'use strict';

// Tokens (ADR 0008): a code and its PKCE verifier buy a short-lived access
// token for the MCP endpoint and a refresh token that rotates. The MCP endpoint
// takes only the tokens issued for it.

const request = require('supertest');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT, MCP_RESOURCE } = oauth;

// Turned on by #1306 (OAuth connection end to end)
describe.skip('token and refresh', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  // A code, and the verifier it was asked with, for Frank in his group.
  const codeFor = async () => {
    const agent = oauth.signIn(app, f.FRANK);
    const { verifier, challenge } = oauth.pkce();
    const uid = await oauth.startConsent(agent, CIMD_CLIENT, challenge);
    const consent = await agent
      .post(`/api/oauth/interactions/${uid}/consent`)
      .send({ groupId: f.CLIENT_GROUP });
    const back = await oauth.followToClient(agent, consent.body.redirectTo);
    return { code: back.searchParams.get('code'), verifier };
  };

  const token = (form) =>
    request(app)
      .post('/oauth/token')
      .type('form')
      .send({
        client_id: CIMD_CLIENT.client_id,
        resource: MCP_RESOURCE,
        ...form,
      });

  const exchange = ({ code, verifier }) =>
    token({
      grant_type: 'authorization_code',
      code,
      code_verifier: verifier,
      redirect_uri: CIMD_CLIENT.redirect_uris[0],
    });

  it('trades a code and its verifier for an access token and a refresh token', async () => {
    const response = await exchange(await codeFor());

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      access_token: expect.any(String),
      refresh_token: expect.any(String),
      token_type: 'Bearer',
      scope: 'mcp:read',
    });
    expect(response.body.expires_in).toBeLessThanOrEqual(3600);
  });

  it('refuses a code with the wrong verifier', async () => {
    const { code } = await codeFor();

    const response = await exchange({ code, verifier: oauth.pkce().verifier });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('invalid_grant');
  });

  it('refuses a code used twice', async () => {
    const grant = await codeFor();
    await exchange(grant);

    const again = await exchange(grant);

    expect(again.body.error).toBe('invalid_grant');
  });

  it('opens the MCP endpoint to the access token', async () => {
    const { body } = await exchange(await codeFor());

    const response = await oauth.callMcp(app, body.access_token);

    expect(response.status).toBe(200);
    expect(JSON.stringify(response.body)).toContain(
      'lepatron://expertises/redaction.subject-line'
    );
  });

  it('refuses a token that is not one of LePatron’s', async () => {
    const response = await oauth.callMcp(app, 'not-a-token');

    expect(response.status).toBe(401);
  });

  it('refuses a token once the group loses MCP access', async () => {
    const { body } = await exchange(await codeFor());

    oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcp: false });
    const response = await oauth.callMcp(app, body.access_token);

    expect(response.status).toBe(403);
  });

  describe('refresh', () => {
    const refresh = (refreshToken) =>
      token({ grant_type: 'refresh_token', refresh_token: refreshToken });

    it('gives a new access token and a new refresh token', async () => {
      const first = (await exchange(await codeFor())).body;

      const response = await refresh(first.refresh_token);

      expect(response.status).toBe(200);
      expect(response.body.access_token).not.toBe(first.access_token);
      expect(response.body.refresh_token).not.toBe(first.refresh_token);
    });

    it('refuses a refresh token already used', async () => {
      const first = (await exchange(await codeFor())).body;
      await refresh(first.refresh_token);

      const again = await refresh(first.refresh_token);

      expect(again.body.error).toBe('invalid_grant');
    });

    // A super admin bound to the client group stays there after a refresh:
    // turning the client group's MCP access off stops the refreshed token.
    it('keeps the group the connection was bound to', async () => {
      const first = await oauth.connect(app, f.ALICE, {
        group: f.CLIENT_GROUP,
      });
      const { body } = await refresh(first.refresh_token);

      oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcp: false });
      const response = await oauth.callMcp(app, body.access_token);

      expect(response.status).toBe(403);
    });
  });
});
