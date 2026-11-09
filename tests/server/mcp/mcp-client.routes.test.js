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
const {
  SecurityEvents,
} = require('../../../packages/server/common/models.common.js');

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

  it.each([
    ['in HTTP on another host', 'http://assistant.example.test/callback'],
    ['in a scheme of its own', 'cursor://anysphere.cursor/callback'],
  ])('names the redirect URI it refuses, %s', async (_case, uri) => {
    const { status, body } = await create(f.TESS, {
      redirectUris: [COPILOT_REDIRECT, uri],
    });

    expect(status).toBe(400);
    expect(body.message).toBe('MCP_CLIENT_INVALID_REDIRECT_URIS');
    expect(body.redirectUri).toBe(uri);
    expect(body.description).toContain(uri);
  });

  it("takes a redirect URI in HTTP to the user's own machine, on any port", async () => {
    const { status } = await create(f.TESS, {
      redirectUris: ['http://127.0.0.1:33418/callback'],
    });

    expect(status).toBe(201);
  });

  it('answers an unknown client by its error code', async () => {
    const { status, body } = await oauth
      .signIn(app, f.TESS)
      .delete(`${CLIENTS}/lepatron-unknown`);

    expect(status).toBe(404);
    expect(body.message).toBe('MCP_CLIENT_NOT_FOUND');
  });
});

// Who registered or deleted a client, for which company: never its secret.
describe('the security events of a client registered by hand', () => {
  const events = () => SecurityEvents.find({}).lean();
  const strip = ({ _id, ...event }) => event;

  it('records its registration, by whom, for which company', async () => {
    const { body } = await create(f.TESS);

    expect((await events()).map(strip)).toEqual([
      { action: 'mcp-client.created', actor: f.TESS, group: f.CLIENT_GROUP },
    ]);
    expect(JSON.stringify(await events())).not.toContain(body.clientSecret);
  });

  it('records its deletion, by whom, for which company', async () => {
    const { clientId } = (await create(f.TESS)).body;

    await oauth.signIn(app, f.ALICE).delete(`${CLIENTS}/${clientId}`);

    expect((await events()).map(strip)).toEqual([
      { action: 'mcp-client.created', actor: f.TESS, group: f.CLIENT_GROUP },
      { action: 'mcp-client.deleted', actor: f.ALICE, group: f.CLIENT_GROUP },
    ]);
  });

  it('records nothing it refused', async () => {
    await create(f.ERIN);
    await create(f.TESS, { name: ' ' });
    await oauth.signIn(app, f.TESS).delete(`${CLIENTS}/lepatron-unknown`);

    expect(await events()).toEqual([]);
  });
});

describe('the security events of MCP settings, as stored', () => {
  const mongoose = require('mongoose');
  const SecurityEventSchema = require('../../../packages/server/security-event/security-event.schema.js');

  it.each([
    'mcp-client.created',
    'mcp-client.deleted',
    'connected-applications.all-revoked',
  ])('is an action the security events accept: %s', (action) => {
    const SecurityEvent = mongoose.model(
      `McpSettingsEvent-${action}`,
      SecurityEventSchema
    );
    const event = new SecurityEvent({
      action,
      actor: f.TESS,
      group: f.CLIENT_GROUP,
    });

    expect(event.validateSync()).toBeUndefined();
  });
});
