/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The clients a company registers by hand (ADR 0012), in its MCP settings:
// its tech admin's or a super admin's, as MCP access is (`group.manage-tech`),
// and no other role's, its company admin included. A tech admin reaches its
// own company alone.

const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const COPILOT_REDIRECT =
  'https://teams.microsoft.com/api/platform/v1.0/oAuthRedirect';
const CLIENTS = `/api/groups/${f.CLIENT_GROUP}/mcp-clients`;

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

// Who manages a company's MCP clients (ADR 0012).
const MANAGES = {
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

const create = (userId, fields = {}) =>
  oauth
    .signIn(app, userId)
    .post(CLIENTS)
    .send({
      name: 'Copilot Studio',
      redirectUris: [COPILOT_REDIRECT],
      ...fields,
    });

describe("a company's MCP clients, for each role", () => {
  it('covers every role', () => {
    expect(Object.keys(USER_OF).sort()).toEqual(Object.values(ROLES).sort());
  });

  it.each(Object.values(ROLES))(
    'lists them for a %s who manages them',
    async (role) => {
      const { status } = await oauth.signIn(app, USER_OF[role]).get(CLIENTS);

      expect(status).toBe(MANAGES[role] ? 200 : 403);
    }
  );

  it.each(Object.values(ROLES))(
    'registers one for a %s who manages them',
    async (role) => {
      const { status } = await create(USER_OF[role]);
      const { body } = await oauth.signIn(app, f.TESS).get(CLIENTS);

      expect(status).toBe(MANAGES[role] ? 201 : 403);
      expect(body.items).toHaveLength(MANAGES[role] ? 1 : 0);
    }
  );

  it.each(Object.values(ROLES))(
    'deletes one for a %s who manages them',
    async (role) => {
      const { clientId } = (await create(f.TESS)).body;

      const { status } = await oauth
        .signIn(app, USER_OF[role])
        .delete(`${CLIENTS}/${clientId}`);
      const { body } = await oauth.signIn(app, f.TESS).get(CLIENTS);

      expect(status).toBe(MANAGES[role] ? 204 : 403);
      expect(body.items).toHaveLength(MANAGES[role] ? 0 : 1);
    }
  );
});

describe("a company's MCP clients, out of reach", () => {
  const otherClients = `/api/groups/${f.OTHER_GROUP}/mcp-clients`;

  it("refuses a tech admin another company's", async () => {
    const agent = oauth.signIn(app, f.TESS);

    const listed = await agent.get(otherClients);
    const created = await agent
      .post(otherClients)
      .send({ name: 'Copilot Studio', redirectUris: [COPILOT_REDIRECT] });

    expect(listed.status).toBe(403);
    expect(listed.body.message).toBe('MCP_FORBIDDEN_COMPANY');
    expect(created.status).toBe(403);
  });

  it('refuses a company named by something else than its id', async () => {
    const { status, body } = await oauth
      .signIn(app, f.ALICE)
      .get('/api/groups/not-an-id/mcp-clients');

    expect(status).toBe(400);
    expect(body.message).toBe('INVALID_GROUP_PARAM');
  });

  it('asks who is there', async () => {
    expect((await request(app).post(CLIENTS).send({})).status).toBe(401);
  });
});

describe('what the API answers a client it refuses', () => {
  it.each([
    ['no name', { name: ' ' }, 'MCP_CLIENT_INVALID_NAME'],
    [
      'no redirect URI',
      { redirectUris: [] },
      'MCP_CLIENT_INVALID_REDIRECT_URIS',
    ],
    [
      'an unknown authentication method',
      { tokenEndpointAuthMethod: 'none' },
      'MCP_CLIENT_INVALID_AUTH_METHOD',
    ],
  ])('names %s by its error code', async (_case, fields, code) => {
    const { status, body } = await create(f.TESS, fields);

    expect(status).toBe(400);
    expect(body.message).toBe(code);
  });

  it('answers an unknown client by its error code', async () => {
    const { status, body } = await oauth
      .signIn(app, f.TESS)
      .delete(`${CLIENTS}/lepatron-unknown`);

    expect(status).toBe(404);
    expect(body.message).toBe('MCP_CLIENT_NOT_FOUND');
  });
});
