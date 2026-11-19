/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Connected applications (GLOSSARY.md, ADR 0012): a user sees the applications
// they connected and revokes them; the group's tech admin revokes all of its.
// A revoked application is stopped at its next call, refresh included.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const { CIMD_CLIENT, MCP_RESOURCE } = oauth;

const refresh = (app, refreshToken) =>
  request(app).post('/oauth/token').type('form').send({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CIMD_CLIENT.client_id,
    resource: MCP_RESOURCE,
  });

describe('connected applications', () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const listFor = (userId) =>
    oauth.signIn(app, userId).get('/api/connected-applications');

  it('lists the applications a user connected, with their group and use', async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    await oauth.callMcp(app, tokens.access_token);

    const { status, body } = await listFor(f.FRANK);

    expect(status).toBe(200);
    expect(body.items).toEqual([
      {
        id: expect.any(String),
        name: 'An assistant',
        group: {
          id: f.CLIENT_GROUP,
          name: 'A client',
          enableMcpModule: true,
          enableMcp: true,
        },
        connectedAt: expect.any(String),
        lastUsedAt: expect.any(String),
      },
    ]);
  });

  it('has not been used before its first call', async () => {
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    const [application] = (await listFor(f.FRANK)).body.items;

    expect(application.lastUsedAt).toBeNull();
  });

  it("does not list another user's applications", async () => {
    await oauth.connect(app, f.ERIN, { group: f.CLIENT_GROUP });

    expect((await listFor(f.FRANK)).body.items).toEqual([]);
  });

  it('stops a revoked application at its next call and its next refresh', async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const [application] = (await listFor(f.FRANK)).body.items;

    const revoked = await oauth
      .signIn(app, f.FRANK)
      .delete(`/api/connected-applications/${application.id}`);

    expect(revoked.status).toBe(204);
    expect((await oauth.callMcp(app, tokens.access_token)).status).toBe(401);
    expect((await refresh(app, tokens.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
  });

  // MCP turned off, a group deleted, a user deactivated or given a new
  // password: the app's events revoke as the user does.
  it('stops an application the app ends at its next call and its next refresh', async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const {
      revokeConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');

    await revokeConnections({ _user: f.FRANK });

    expect((await listFor(f.FRANK)).body.items).toEqual([]);
    expect((await oauth.callMcp(app, tokens.access_token)).status).toBe(401);
    expect((await refresh(app, tokens.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
  });

  // The same application on two machines (Claude Code, VS Code): one
  // connection per consent, each living on.
  it('keeps the connection of an application connected again', async () => {
    const first = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const second = await oauth.connect(app, f.FRANK, {
      group: f.CLIENT_GROUP,
    });

    expect((await listFor(f.FRANK)).body.items).toHaveLength(2);
    expect((await refresh(app, first.refresh_token)).body.access_token).toEqual(
      expect.any(String)
    );
    expect((await oauth.callMcp(app, second.access_token)).status).toBe(200);
  });

  // Decided with the product (ADR 0012): ten connections of a user through
  // one client for one company, the oldest revoked past them.
  it('revokes the oldest connection of an application connected an eleventh time', async () => {
    const connections = [];
    // eslint-disable-next-line no-restricted-syntax
    for (let machine = 0; machine < 11; machine += 1) {
      // eslint-disable-next-line no-await-in-loop
      connections.push(
        await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP })
      );
    }
    const [oldest, second] = connections;
    const newest = connections[10];
    await oauth.connect(app, f.ERIN, { group: f.CLIENT_GROUP });

    expect((await listFor(f.FRANK)).body.items).toHaveLength(10);
    expect((await listFor(f.ERIN)).body.items).toHaveLength(1);
    expect((await oauth.callMcp(app, oldest.access_token)).status).toBe(401);
    expect((await refresh(app, oldest.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
    expect((await oauth.callMcp(app, second.access_token)).status).toBe(200);
    expect((await oauth.callMcp(app, newest.access_token)).status).toBe(200);
  });

  it("does not let a user revoke another user's application", async () => {
    await oauth.connect(app, f.ERIN, { group: f.CLIENT_GROUP });
    const [application] = (await listFor(f.ERIN)).body.items;

    const response = await oauth
      .signIn(app, f.FRANK)
      .delete(`/api/connected-applications/${application.id}`);

    expect(response.status).toBe(404);
  });

  it("lets the tech admin revoke every application of the group, and only the group's", async () => {
    const frank = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const response = await oauth
      .signIn(app, f.TESS)
      .delete(`/api/groups/${f.CLIENT_GROUP}/connected-applications`);

    expect(response.status).toBe(204);
    expect((await oauth.callMcp(app, frank.access_token)).status).toBe(401);
    expect((await oauth.callMcp(app, otto.access_token)).status).toBe(200);
  });

  // Every role's rights: tests/server/mcp/connected-application.routes.test.js.
});

// A connection lasts 90 days whatever the browser it was consented in does
// (ADR 0012): it ends when it is revoked, never with the authorization
// server's session of that browser.
describe('a connection and the session of its browser', () => {
  const DAY_MS = 24 * 3600 * 1000;
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });
  afterEach(() => {
    oauth.restoreClock();
  });

  it('lives on when the same browser connects the application again', async () => {
    const agent = oauth.signIn(app, f.FRANK);
    const first = await oauth.connect(app, f.FRANK, {
      group: f.CLIENT_GROUP,
      agent,
    });
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP, agent });

    expect((await oauth.callMcp(app, first.access_token)).status).toBe(200);
    expect((await refresh(app, first.refresh_token)).body.access_token).toEqual(
      expect.any(String)
    );
  });

  it("lives on once the browser's session is gone", async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    await oauth.oauthStore('Session').deleteMany({});

    expect((await oauth.callMcp(app, tokens.access_token)).status).toBe(200);
    expect(
      (await refresh(app, tokens.refresh_token)).body.access_token
    ).toEqual(expect.any(String));
  });

  it("refreshes past the browser's session, a day later", async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    oauth.later(DAY_MS + 60 * 1000);
    const { body } = await refresh(app, tokens.refresh_token);

    expect(body.access_token).toEqual(expect.any(String));
    expect((await oauth.callMcp(app, body.access_token)).status).toBe(200);
  });

  it('stays refused once revoked', async () => {
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const [connection] = (
      await oauth.signIn(app, f.FRANK).get('/api/connected-applications')
    ).body.items;

    await oauth
      .signIn(app, f.FRANK)
      .delete(`/api/connected-applications/${connection.id}`);
    oauth.later(DAY_MS + 60 * 1000);

    expect((await oauth.callMcp(app, tokens.access_token)).status).toBe(401);
    expect((await refresh(app, tokens.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
  });
});

describe("a group's connected applications", () => {
  let app;
  beforeEach(() => {
    app = oauth.createApp();
  });

  const countAs = async (userId, groupId) =>
    oauth
      .signIn(app, userId)
      .get(`/api/groups/${groupId}/connected-applications`);

  it("counts them for the group's tech admin", async () => {
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const { status, body } = await countAs(f.TESS, f.CLIENT_GROUP);

    expect(status).toBe(200);
    expect(body).toEqual({ count: 1 });
  });

  it("refuses the admin of another group, and lets a super admin revoke any group's", async () => {
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const refused = await oauth
      .signIn(app, f.TESS)
      .delete(`/api/groups/${f.OTHER_GROUP}/connected-applications`);
    const revoked = await oauth
      .signIn(app, f.ALICE)
      .delete(`/api/groups/${f.OTHER_GROUP}/connected-applications`);

    expect(refused.status).toBe(403);
    expect(revoked.status).toBe(204);
    expect((await oauth.callMcp(app, otto.access_token)).status).toBe(401);
  });

  it('refuses a group named by something else than its id', async () => {
    expect((await countAs(f.TESS, 'not-an-id')).status).toBe(400);
  });
});

describe('revocation', () => {
  it('revokes a refresh token at the revocation endpoint', async () => {
    const app = oauth.createApp();
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    const revoked = await request(app)
      .post('/oauth/token/revocation')
      .type('form')
      .send({ token: tokens.refresh_token, client_id: CIMD_CLIENT.client_id });

    expect(revoked.status).toBe(200);
    expect((await refresh(app, tokens.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
  });

  it('unlists an application that revoked its own refresh token', async () => {
    const app = oauth.createApp();
    const tokens = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

    await request(app)
      .post('/oauth/token/revocation')
      .type('form')
      .send({ token: tokens.refresh_token, client_id: CIMD_CLIENT.client_id });

    expect(
      (await oauth.signIn(app, f.FRANK).get('/api/connected-applications')).body
        .items
    ).toEqual([]);
  });
});
