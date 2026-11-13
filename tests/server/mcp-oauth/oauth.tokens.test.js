/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Tokens (ADR 0012): a code and its PKCE verifier buy a short-lived access
// token for the MCP endpoint and a refresh token that rotates. The MCP endpoint
// takes only the tokens issued for it.

jest.doMock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT, MCP_RESOURCE } = oauth;

describe('token and refresh', () => {
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
      .post(`/oauth/consent/${uid}/consent`)
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

  it('keeps neither the code nor the tokens it issued as they are', async () => {
    const grant = await codeFor();
    const { body } = await exchange(grant);

    const kept = JSON.stringify(
      ['AuthorizationCode', 'AccessToken', 'RefreshToken'].map(
        (model) => oauth.oauthStore(model).records
      )
    );

    expect(kept).not.toContain(grant.code);
    expect(kept).not.toContain(body.access_token);
    expect(kept).not.toContain(body.refresh_token);
    expect((await oauth.callMcp(app, body.access_token)).status).toBe(200);
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
    // As JSON or as a server-sent event, as the transport chooses.
    expect(response.text).toContain(
      'lepatron://expertises/redaction.subject-line'
    );
  });

  // The scheme is read whatever its case (RFC 7235, section 2.1).
  it('opens the MCP endpoint to the access token under a lower-case scheme', async () => {
    const { body } = await exchange(await codeFor());

    const response = await oauth
      .callMcp(app, null)
      .set('Authorization', `bearer ${body.access_token}`);

    expect(response.status).toBe(200);
  });

  // Checked at the endpoint, before any MCP exchange, then read by the
  // call it serves.
  it('reads who calls once per call', async () => {
    const { body } = await exchange(await codeFor());
    const {
      Users,
      Groups,
    } = require('../../../packages/server/common/models.common.js');
    const users = jest.spyOn(Users, 'findOne');
    const groups = jest.spyOn(Groups, 'findById');

    const response = await oauth.callMcp(app, body.access_token);

    expect(response.status).toBe(200);
    expect(users).toHaveBeenCalledTimes(1);
    expect(groups).toHaveBeenCalledTimes(1);
    users.mockRestore();
    groups.mockRestore();
  });

  it('refuses a token that is not one of LePatron’s', async () => {
    const response = await oauth.callMcp(app, 'not-a-token');

    expect(response.status).toBe(401);
    // The OAuth error body (RFC 6750): the client reauthorizes.
    expect(response.body.error).toBe('invalid_token');
    expect(response.headers['www-authenticate']).toMatch(
      /^Bearer error="invalid_token", /
    );
  });

  // No error code without a bearer token (RFC 6750, section 3.1): the
  // client was not refused a token, it sent none.
  it.each([
    ['no credentials', null],
    ['credentials of another scheme', 'Basic dXNlcjpwYXNzd29yZA=='],
    ['a bearer scheme without a token', 'Bearer '],
  ])('refuses %s without an error code', async (_case, header) => {
    const call = oauth.callMcp(app, null);
    const response = await (header ? call.set('Authorization', header) : call);

    expect(response.status).toBe(401);
    expect(response.body.error).toBeUndefined();
    expect(response.body.error_description).toEqual(expect.any(String));
    expect(response.headers['www-authenticate']).toMatch(/^Bearer /);
    expect(response.headers['www-authenticate']).not.toMatch(/error=/);
  });

  it('refuses a token once the group loses MCP access', async () => {
    const { body } = await exchange(await codeFor());

    oauth.update(app, 'groups', f.CLIENT_GROUP, { enableMcp: false });
    const response = await oauth.callMcp(app, body.access_token);

    expect(response.status).toBe(403);
    // Not insufficient_scope: no new consent would open the door.
    expect(response.body.error).toBe('access_denied');
    expect(response.headers['www-authenticate']).toBeUndefined();
  });

  // A failure of the server is not a refusal: the error handler answers it
  // with a 500, without an OAuth error code nor a challenge.
  it('answers a failure while reading who calls as a failure of the server', async () => {
    const { body } = await exchange(await codeFor());
    const {
      Users,
    } = require('../../../packages/server/common/models.common.js');
    const findOne = jest.spyOn(Users, 'findOne').mockImplementation(() => {
      throw new Error('The database is out of reach');
    });

    const response = await oauth.callMcp(app, body.access_token);
    findOne.mockRestore();

    expect(response.status).toBe(500);
    expect(response.body.error).toBeUndefined();
    expect(response.headers['www-authenticate']).toBeUndefined();
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

    // A client may send the refresh token it just traded once more: two of
    // its requests at once, or a retry when the answer was lost. Within a
    // minute of its first use, that is a client's, not a thief's.
    describe('a refresh token already used', () => {
      let now;
      beforeEach(() => {
        now = Date.now();
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        logger.warn.mockClear();
      });
      afterEach(() => jest.restoreAllMocks());
      const later = (seconds) => {
        now += seconds * 1000;
      };

      it('gives a new access token again, within a minute of its first use', async () => {
        const first = (await exchange(await codeFor())).body;
        await refresh(first.refresh_token);
        later(10);

        const again = await refresh(first.refresh_token);

        expect(again.status).toBe(200);
        expect(again.body.access_token).toEqual(expect.any(String));
        expect(again.body.refresh_token).not.toBe(first.refresh_token);
      });

      it('keeps the connection open to the refresh token it traded first', async () => {
        const first = (await exchange(await codeFor())).body;
        const traded = (await refresh(first.refresh_token)).body;
        later(10);
        await refresh(first.refresh_token);

        const response = await refresh(traded.refresh_token);

        expect(response.status).toBe(200);
      });

      it('refuses it past the minute, and ends the connection', async () => {
        const first = (await exchange(await codeFor())).body;
        const traded = (await refresh(first.refresh_token)).body;
        later(61);

        const again = await refresh(first.refresh_token);
        const after = await refresh(traded.refresh_token);

        expect(again.body.error).toBe('invalid_grant');
        expect(after.body.error).toBe('invalid_grant');
      });

      it('counts the minute from its first use, not from a retry', async () => {
        const first = (await exchange(await codeFor())).body;
        await refresh(first.refresh_token);
        later(50);
        await refresh(first.refresh_token);
        later(20);

        const again = await refresh(first.refresh_token);

        expect(again.body.error).toBe('invalid_grant');
      });

      it('logs why it refused it', async () => {
        const first = (await exchange(await codeFor())).body;
        await refresh(first.refresh_token);
        later(61);

        await refresh(first.refresh_token);

        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('refresh token already used')
        );
      });
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

// The clients only ask for the read scope the server advertises: the consent
// grants drafting to whoever may manage the platform (ADR 0014), and to no one
// else, whatever is asked.
describe('the scopes a token carries', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  // Answered as JSON, or as an event stream whose data is the JSON-RPC answer.
  const toolsOf = async (accessToken) => {
    const response = await oauth.callMcp(app, accessToken, 'tools/list');
    const data = /^data: (.*)$/m.exec(response.text);
    const answer = data ? JSON.parse(data[1]) : response.body;
    return answer.result.tools.map((tool) => tool.name);
  };

  it('gives a super admin who ticks it the drafting scope, though only reading was asked for', async () => {
    const tokens = await oauth.connect(app, f.ALICE, {
      group: f.PLATFORM_GROUP,
      scope: 'mcp:read',
      allowWrite: true,
    });

    expect(tokens.scope.split(' ').sort()).toEqual([
      'mcp:read',
      'skills:write',
    ]);
    expect(await toolsOf(tokens.access_token)).toContain('create_expertise');
  });

  // The platform company's work is done on a connection to it (ADR 0019).
  it('keeps a super admin who ticks it on a client company to reading', async () => {
    const tokens = await oauth.connect(app, f.ALICE, {
      group: f.CLIENT_GROUP,
      scope: 'mcp:read skills:write',
      allowWrite: true,
    });

    expect(tokens.scope).toBe('mcp:read');
    expect(await toolsOf(tokens.access_token)).not.toContain(
      'create_expertise'
    );
  });

  it('keeps a super admin who does not tick it to reading', async () => {
    const tokens = await oauth.connect(app, f.ALICE, {
      group: f.CLIENT_GROUP,
      scope: 'mcp:read skills:write',
    });

    expect(tokens.scope).toBe('mcp:read');
    expect(await toolsOf(tokens.access_token)).not.toContain(
      'create_expertise'
    );
  });

  it('keeps a regular user to reading, though drafting was asked for and ticked', async () => {
    const tokens = await oauth.connect(app, f.FRANK, {
      group: f.CLIENT_GROUP,
      scope: 'mcp:read skills:write',
      allowWrite: true,
    });

    expect(tokens.scope).toBe('mcp:read');
    expect(await toolsOf(tokens.access_token)).not.toContain(
      'create_expertise'
    );
  });

  it('keeps the scope through a refresh', async () => {
    const tokens = await oauth.connect(app, f.ALICE, {
      group: f.PLATFORM_GROUP,
      allowWrite: true,
    });

    const { body } = await request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token',
      refresh_token: tokens.refresh_token,
      client_id: CIMD_CLIENT.client_id,
      resource: oauth.MCP_RESOURCE,
    });

    expect(body.scope.split(' ').sort()).toEqual(['mcp:read', 'skills:write']);
  });
});

describe('audience', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  // A token of LePatron's authorization server, valid in every way but the
  // resource it was issued for: its connection stands.
  const tokenFor = async (aud) => {
    const client = await app.provider.Client.find(CIMD_CLIENT.client_id);
    // The stand-ins of the harness.
    const {
      McpConnections,
    } = require('../../../packages/server/common/models.common.js');
    await McpConnections.create({
      grantId: 'a-grant',
      clientId: CIMD_CLIENT.client_id,
      clientName: CIMD_CLIENT.client_name,
      _user: f.FRANK,
      _company: f.CLIENT_GROUP,
      connectedAt: new Date(),
      lastUsedAt: null,
      expiresAt: new Date(Date.now() + 3600 * 1000),
    });
    const token = new app.provider.AccessToken({
      accountId: `${f.FRANK}.${f.CLIENT_GROUP}`,
      client,
      grantId: 'a-grant',
      scope: 'mcp:read',
      aud,
    });
    return token.save();
  };

  it('opens the MCP endpoint to a token issued for it', async () => {
    const response = await oauth.callMcp(app, await tokenFor(MCP_RESOURCE));

    expect(response.status).toBe(200);
  });

  it('refuses a token issued for another resource', async () => {
    const response = await oauth.callMcp(
      app,
      await tokenFor('https://elsewhere.example.test/api')
    );

    expect(response.status).toBe(401);
  });
});
