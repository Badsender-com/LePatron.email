/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Connected applications (ADR 0012): every user lists and revokes their own,
// whatever their role; a company's are counted and revoked at once by its
// tech admin or a super admin, and by no other role, its company admin
// included. A tech admin reaches its own company alone.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const {
  McpConnections,
  SecurityEvents,
} = require('../../../packages/server/common/models.common.js');

const OWN = '/api/connected-applications';
const OF_COMPANY = `/api/groups/${f.CLIENT_GROUP}/connected-applications`;

// Each role, by a user of the client company (the super admin, of the
// platform company, reaches it as any company).
const USER_OF = {
  [ROLES.SUPER_ADMIN]: f.ALICE,
  [ROLES.GROUP_ADMIN_TECH]: f.TESS,
  [ROLES.GROUP_ADMIN]: f.ERIN,
  [ROLES.REGULAR_USER]: f.FRANK,
  [ROLES.WRITER]: f.WREN,
  [ROLES.REVIEWER]: f.REX,
};

// Who revokes all of a company's connected applications (ADR 0012).
const REVOKES_ALL = {
  [ROLES.SUPER_ADMIN]: true,
  [ROLES.GROUP_ADMIN_TECH]: true,
  [ROLES.GROUP_ADMIN]: false,
  [ROLES.REGULAR_USER]: false,
  [ROLES.WRITER]: false,
  [ROLES.REVIEWER]: false,
};

let app;
beforeEach(() => {
  app = oauth.createApp();
});

let grants = 0;
// A connection as the consent records it, of `userId` in `groupId`.
function connected(userId, groupId = f.CLIENT_GROUP) {
  grants += 1;
  return McpConnections.create({
    grantId: `grant-${grants}`,
    clientId: oauth.CIMD_CLIENT.client_id,
    clientName: 'An assistant',
    _user: userId,
    _company: groupId,
    connectedAt: new Date(),
    lastUsedAt: null,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
}

const listOf = async (userId) =>
  (await oauth.signIn(app, userId).get(OWN)).body.items;

it('covers every role', () => {
  expect(Object.keys(USER_OF).sort()).toEqual(Object.values(ROLES).sort());
});

describe("a user's own connected applications, for each role", () => {
  it.each(Object.values(ROLES))('lists them for a %s', async (role) => {
    await connected(USER_OF[role]);

    const { status, body } = await oauth.signIn(app, USER_OF[role]).get(OWN);

    expect(status).toBe(200);
    expect(body.items).toHaveLength(1);
  });

  it.each(Object.values(ROLES))('revokes one for a %s', async (role) => {
    const connection = await connected(USER_OF[role]);

    const { status } = await oauth
      .signIn(app, USER_OF[role])
      .delete(`${OWN}/${connection._id}`);

    expect(status).toBe(204);
    expect(await listOf(USER_OF[role])).toEqual([]);
  });

  it.each(Object.values(ROLES))(
    "answers a %s another user's as unknown",
    async (role) => {
      const connection = await connected(f.OTTO, f.OTHER_GROUP);

      const { status, body } = await oauth
        .signIn(app, USER_OF[role])
        .delete(`${OWN}/${connection._id}`);

      expect(status).toBe(404);
      expect(body.message).toBe('MCP_CONNECTION_NOT_FOUND');
      expect(await listOf(f.OTTO)).toHaveLength(1);
    }
  );

  // One connection per consent: the same assistant from two machines.
  it('lists each connection of an application connected twice', async () => {
    const first = await connected(f.FRANK);
    const second = await connected(f.FRANK);

    const items = await listOf(f.FRANK);

    expect(items.map(({ id }) => id).sort()).toEqual(
      [String(first._id), String(second._id)].sort()
    );
    expect(items.map(({ name }) => name)).toEqual([
      'An assistant',
      'An assistant',
    ]);
  });

  it('asks who is there', async () => {
    expect((await request(app).get(OWN)).status).toBe(401);
    expect((await request(app).delete(`${OWN}/${f.FRANK}`)).status).toBe(401);
  });
});

// The page says when a connection's company lets no assistant in (ADR 0017):
// each row carries the MCP module and MCP access of its company.
describe('the company of each connection', () => {
  it('says whether it has the MCP module and MCP access', async () => {
    oauth.update(app, 'groups', f.OTHER_GROUP, { enableMcpModule: false });
    const open = await connected(f.ALICE, f.CLIENT_GROUP);
    const accessOff = await connected(f.ALICE, f.MCP_ACCESS_OFF_GROUP);
    const moduleClosed = await connected(f.ALICE, f.OTHER_GROUP);

    const items = await listOf(f.ALICE);
    const groupOf = (connection) =>
      items.find(({ id }) => id === String(connection._id)).group;

    expect(groupOf(open)).toEqual({
      id: f.CLIENT_GROUP,
      name: 'A client',
      enableMcpModule: true,
      enableMcp: true,
    });
    expect(groupOf(accessOff)).toMatchObject({
      enableMcpModule: true,
      enableMcp: false,
    });
    expect(groupOf(moduleClosed)).toMatchObject({
      enableMcpModule: false,
      enableMcp: true,
    });
  });
});

describe("a company's connected applications, for each role", () => {
  it.each(Object.values(ROLES))(
    'counts them for a %s who revokes them all',
    async (role) => {
      await connected(f.FRANK);

      const { status, body } = await oauth
        .signIn(app, USER_OF[role])
        .get(OF_COMPANY);

      expect(status).toBe(REVOKES_ALL[role] ? 200 : 403);
      if (REVOKES_ALL[role]) expect(body).toEqual({ count: 1 });
    }
  );

  it.each(Object.values(ROLES))(
    'revokes them all for a %s who may',
    async (role) => {
      await connected(f.FRANK);

      const { status } = await oauth
        .signIn(app, USER_OF[role])
        .delete(OF_COMPANY);

      expect(status).toBe(REVOKES_ALL[role] ? 204 : 403);
      expect(await listOf(f.FRANK)).toHaveLength(REVOKES_ALL[role] ? 0 : 1);
    }
  );

  it("refuses a tech admin another company's", async () => {
    await connected(f.OTTO, f.OTHER_GROUP);
    const path = `/api/groups/${f.OTHER_GROUP}/connected-applications`;
    const agent = oauth.signIn(app, f.TESS);

    const counted = await agent.get(path);
    const revoked = await agent.delete(path);

    expect(counted.status).toBe(403);
    expect(revoked.status).toBe(403);
    expect(revoked.body.message).toBe('MCP_FORBIDDEN_COMPANY');
    expect(await listOf(f.OTTO)).toHaveLength(1);
  });

  it('refuses a company named by something else than its id', async () => {
    const { status } = await oauth
      .signIn(app, f.ALICE)
      .delete('/api/groups/not-an-id/connected-applications');

    expect(status).toBe(400);
  });
});

describe("the security event of a company's connected applications revoked", () => {
  const events = async () =>
    (await SecurityEvents.find({}).lean()).map(({ _id, ...event }) => event);

  it('records who revoked them all, for which company', async () => {
    await connected(f.FRANK);

    await oauth.signIn(app, f.TESS).delete(OF_COMPANY);

    expect(await events()).toEqual([
      {
        action: 'connected-applications.all-revoked',
        actor: f.TESS,
        group: f.CLIENT_GROUP,
      },
    ]);
  });

  it("records nothing for a refusal, nor for a user's own revocation", async () => {
    const connection = await connected(f.FRANK);

    await oauth.signIn(app, f.ERIN).delete(OF_COMPANY);
    await oauth.signIn(app, f.FRANK).delete(`${OWN}/${connection._id}`);

    expect(await events()).toEqual([]);
  });
});
