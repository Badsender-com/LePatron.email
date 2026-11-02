/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Connected applications (GLOSSARY.md, ADR 0012): a user sees the applications
// they connected and revokes them; a company admin revokes all of the group's.
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
        group: { id: f.CLIENT_GROUP, name: 'A client' },
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

  it("does not let a user revoke another user's application", async () => {
    await oauth.connect(app, f.ERIN, { group: f.CLIENT_GROUP });
    const [application] = (await listFor(f.ERIN)).body.items;

    const response = await oauth
      .signIn(app, f.FRANK)
      .delete(`/api/connected-applications/${application.id}`);

    expect(response.status).toBe(404);
  });

  it("lets a company admin revoke every application of the group, and only the group's", async () => {
    const frank = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const response = await oauth
      .signIn(app, f.ERIN)
      .delete(`/api/groups/${f.CLIENT_GROUP}/connected-applications`);

    expect(response.status).toBe(204);
    expect((await oauth.callMcp(app, frank.access_token)).status).toBe(401);
    expect((await oauth.callMcp(app, otto.access_token)).status).toBe(200);
  });

  it('refuses a regular user counting or revoking a whole group', async () => {
    const agent = oauth.signIn(app, f.FRANK);
    const path = `/api/groups/${f.CLIENT_GROUP}/connected-applications`;

    expect((await agent.get(path)).status).toBe(403);
    expect((await agent.delete(path)).status).toBe(403);
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

  it('counts them for the group admin', async () => {
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const { status, body } = await countAs(f.ERIN, f.CLIENT_GROUP);

    expect(status).toBe(200);
    expect(body).toEqual({ count: 1 });
  });

  it("refuses the admin of another group, and lets a super admin revoke any group's", async () => {
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });

    const refused = await oauth
      .signIn(app, f.ERIN)
      .delete(`/api/groups/${f.OTHER_GROUP}/connected-applications`);
    const revoked = await oauth
      .signIn(app, f.ALICE)
      .delete(`/api/groups/${f.OTHER_GROUP}/connected-applications`);

    expect(refused.status).toBe(403);
    expect(revoked.status).toBe(204);
    expect((await oauth.callMcp(app, otto.access_token)).status).toBe(401);
  });

  it('refuses a group named by something else than its id', async () => {
    expect((await countAs(f.ERIN, 'not-an-id')).status).toBe(403);
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
