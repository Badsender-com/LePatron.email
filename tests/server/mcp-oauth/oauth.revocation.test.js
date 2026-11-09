/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// Revoking connected applications from the store of the authorization server
// (ADR 0012), mounted or not: one connection, many, or all of them, and the
// oldest of a user's past the bound.

const mongoose = require('mongoose');
const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');

const {
  McpOAuthAdapter,
} = require('../../../packages/server/mcp/mcp-oauth-adapter.js');

describe('revoking connections', () => {
  const ISSUED = ['AccessToken', 'RefreshToken', 'AuthorizationCode'];

  // A fresh copy of the module, which no authorization server was mounted
  // with, as in a script, over the same database.
  const unmounted = (path) => {
    let module;
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require
      require('mongoose').connection.db = mongoose.connection.db;
      // eslint-disable-next-line global-require, import/no-dynamic-require
      module = require(path);
    });
    return module;
  };

  it('revokes their grants and tokens without the authorization server', async () => {
    const app = oauth.createApp();
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const { forgetConnections } = unmounted(
      '../../../packages/server/mcp/mcp-connections.js'
    );

    await forgetConnections({ _user: f.FRANK });

    [...ISSUED, 'Grant'].forEach((model) =>
      expect(oauth.oauthStore(model).records).toEqual([])
    );
  });

  it('revokes many connections with one query per model', async () => {
    const app = oauth.createApp();
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    await oauth.connect(app, f.ERIN, { group: f.CLIENT_GROUP });
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });
    const deletes = [...ISSUED, 'Grant'].map((model) =>
      jest.spyOn(oauth.oauthStore(model), 'deleteMany')
    );
    const {
      revokeConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');

    await revokeConnections({ _company: f.CLIENT_GROUP });

    deletes.forEach((deleteMany) =>
      expect(deleteMany).toHaveBeenCalledTimes(1)
    );
    expect(oauth.oauthStore('Grant').records).toHaveLength(1);
    expect((await oauth.callMcp(app, otto.access_token)).status).toBe(200);
  });

  it.each([
    [
      'in its former form, after the authorization server',
      (filter, app) => [app.provider, filter],
    ],
    ['by an empty filter', () => [{}]],
    ['by no filter', () => []],
  ])('revokes nothing when called %s', async (_case, argsOf) => {
    const app = oauth.createApp();
    await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const {
      revokeConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');

    await expect(
      revokeConnections(...argsOf({ _user: f.FRANK }, app))
    ).rejects.toThrow(TypeError);

    expect(oauth.stored('connections')).toHaveLength(1);
    expect(oauth.oauthStore('Grant').records).toHaveLength(1);
  });

  describe('the connections it unlists', () => {
    const {
      McpConnections,
    } = require('../../../packages/server/common/models.common.js');
    const {
      revokeConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');
    const connection = (grantId) => ({
      grantId,
      clientId: 'a-client',
      clientName: 'An assistant',
      _user: f.FRANK,
      _company: f.CLIENT_GROUP,
      connectedAt: new Date(),
    });

    beforeEach(() => {
      oauth.createApp();
    });

    it('are the very ones it read: a consent given meanwhile stands', async () => {
      await McpConnections.create(connection('grant-read'));
      const deleteMany = McpConnections.deleteMany;
      jest
        .spyOn(McpConnections, 'deleteMany')
        .mockImplementationOnce(async (filter) => {
          await McpConnections.create(connection('grant-meanwhile'));
          return deleteMany(filter);
        });

      await revokeConnections({ _user: f.FRANK });

      expect(
        oauth.stored('connections').map(({ grantId }) => grantId)
      ).toEqual(['grant-meanwhile']);
      McpConnections.deleteMany.mockRestore();
    });

    it('go 500 at most a query', async () => {
      await Promise.all(
        Array.from({ length: 1200 }, (_, index) =>
          McpConnections.create(connection(`grant-${index}`))
        )
      );
      const deleteMany = jest.spyOn(McpConnections, 'deleteMany');

      await revokeConnections({ _user: f.FRANK });

      expect(
        deleteMany.mock.calls.map(([filter]) => filter.grantId.$in.length)
      ).toEqual([500, 500, 200]);
      expect(oauth.stored('connections')).toEqual([]);
      deleteMany.mockRestore();
    });
  });

  it("forgets a deleted company's clients without the authorization server", async () => {
    const app = oauth.createApp();
    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(`/api/groups/${f.CLIENT_GROUP}/mcp-clients`)
      .send({
        name: 'Copilot Studio',
        redirectUris: ['https://copilot.example.test/callback'],
      });
    const { forgetCompanyClients } = unmounted(
      '../../../packages/server/mcp/mcp-clients.js'
    );

    await forgetCompanyClients(f.CLIENT_GROUP);

    expect(JSON.stringify(oauth.oauthStore('Client').records)).not.toContain(
      body.clientId
    );
    expect(oauth.stored('clients')).toEqual([]);
  });
});

// One connection per consent (ADR 0012): an assistant installed on several
// machines has the same client id on each.
describe('recording a connection', () => {
  const {
    recordConnection,
  } = require('../../../packages/server/mcp/mcp-connections.js');
  // Decided with the product (ADR 0012).
  const MAX_CONNECTIONS = 10;
  const CLIENT = 'https://assistant.example.test/oauth/client.json';

  const record = (grantId, overrides = {}) =>
    recordConnection({
      grantId,
      clientId: CLIENT,
      clientName: 'An assistant',
      userId: f.FRANK,
      groupId: f.CLIENT_GROUP,
      ttl: 3600,
      ...overrides,
    });
  const grantsKept = () =>
    oauth
      .stored('connections')
      .map(({ grantId }) => grantId)
      .sort();

  beforeEach(() => {
    oauth.createApp();
  });

  it('keeps the connections the user made before', async () => {
    await record('grant-1');
    await record('grant-2');

    expect(grantsKept()).toEqual(['grant-1', 'grant-2']);
  });

  it(`keeps ${MAX_CONNECTIONS} of them, the oldest revoked`, async () => {
    const grantIds = Array.from(
      { length: MAX_CONNECTIONS + 2 },
      (_, index) => `grant-${String(index).padStart(2, '0')}`
    );
    await Promise.all(
      grantIds.map((grantId) =>
        new McpOAuthAdapter('Grant').upsert(grantId, { jti: grantId }, 60)
      )
    );
    // eslint-disable-next-line no-restricted-syntax
    for (const grantId of grantIds) {
      // eslint-disable-next-line no-await-in-loop
      await record(grantId);
    }

    expect(grantsKept()).toEqual(grantIds.slice(2));
    expect(oauth.oauthStore('Grant').records.map(({ _id }) => _id)).toEqual(
      grantIds.slice(2)
    );
  });

  it("counts the user's connections through that client, for that company", async () => {
    await record('grant-other-client', { clientId: 'another-client' });
    await record('grant-other-company', { groupId: f.OTHER_GROUP });
    await record('grant-other-user', { userId: f.ERIN });

    await record('grant-1', { cap: 1 });
    await record('grant-2', { cap: 1 });

    expect(grantsKept()).toEqual([
      'grant-2',
      'grant-other-client',
      'grant-other-company',
      'grant-other-user',
    ]);
  });
});

// What scripts/mcp-revoke-all.js runs: every assistant cut off at once.
describe('revoking every connection', () => {
  const REFRESH = (app, refreshToken) =>
    request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: oauth.CIMD_CLIENT.client_id,
      resource: oauth.MCP_RESOURCE,
    });

  it('stops every connected application, and keeps the clients', async () => {
    const app = oauth.createApp();
    const { body: client } = await oauth
      .signIn(app, f.ALICE)
      .post(`/api/groups/${f.CLIENT_GROUP}/mcp-clients`)
      .send({
        name: 'Copilot Studio',
        redirectUris: ['https://copilot.example.test/callback'],
      });
    const frank = await oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });
    const otto = await oauth.connect(app, f.OTTO, { group: f.OTHER_GROUP });
    const {
      revokeAllConnections,
    } = require('../../../packages/server/mcp/mcp-connections.js');

    const counts = await revokeAllConnections();

    expect(counts).toMatchObject({ connections: 2, Grant: 2 });
    expect(oauth.stored('connections')).toEqual([]);
    const calls = await Promise.all(
      [frank, otto].map((tokens) => oauth.callMcp(app, tokens.access_token))
    );
    const refreshes = await Promise.all(
      [frank, otto].map((tokens) => REFRESH(app, tokens.refresh_token))
    );
    expect(calls.map(({ status }) => status)).toEqual([401, 401]);
    expect(refreshes.map(({ body }) => body.error)).toEqual([
      'invalid_grant',
      'invalid_grant',
    ]);
    expect(oauth.stored('clients')).toEqual([
      expect.objectContaining({ clientId: client.clientId }),
    ]);
  });
});
