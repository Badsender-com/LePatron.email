/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The secrets of the clients, and the clients a company registers by hand
// (ADR 0012), as the authorization server keeps them: a secret as its
// digest, a client registered by hand in the company's settings alone.

const mongoose = require('mongoose');
const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');
const { createFakeDb } = require('../../helpers/fake-mongo-collection');

const {
  McpOAuthAdapter,
} = require('../../../packages/server/mcp/mcp-oauth-adapter.js');

let db;
beforeEach(() => {
  db = createFakeDb();
  mongoose.connection.db = db;
});

const stored = (model) =>
  db.collection(`mcp_oauth_${model.toLowerCase()}`).records;

describe("a client's secret", () => {
  const REDIRECT = 'https://copilot.example.test/callback';

  it('is kept as its digest, once', async () => {
    const adapter = new McpOAuthAdapter('Client');
    await adapter.upsert('a-client', {
      client_id: 'a-client',
      client_secret: 'a-secret',
    });
    const digest = (await adapter.find('a-client')).client_secret;

    // As keepRegisteredClient keeps it again, as found.
    await adapter.upsert('a-client', await adapter.find('a-client'), 60);

    expect(JSON.stringify(stored('Client'))).not.toContain('a-secret');
    expect((await adapter.find('a-client')).client_secret).toBe(digest);
  });

  describe('of a client that registered', () => {
    let app;
    let client;
    beforeEach(async () => {
      app = oauth.createApp();
      ({ body: client } = await request(app)
        .post('/oauth/reg')
        .send({
          client_name: 'A copilot',
          redirect_uris: [REDIRECT],
          token_endpoint_auth_method: 'client_secret_post',
        }));
    });

    it('is not kept as it is', () => {
      expect(client.client_secret).toEqual(expect.any(String));
      expect(JSON.stringify(oauth.oauthStore('Client').records)).not.toContain(
        client.client_secret
      );
    });

    it('is what the client proves itself with', async () => {
      const tokens = await oauth.connect(app, f.FRANK, {
        client,
        group: f.CLIENT_GROUP,
        secret: client.client_secret,
      });
      const kept = oauth.oauthStore('Client').records[0];
      const asKept = await oauth.connect(app, f.FRANK, {
        client,
        group: f.CLIENT_GROUP,
        secret: JSON.parse(kept.payload).client_secret,
      });

      expect(tokens.access_token).toEqual(expect.any(String));
      expect(asKept.error).toBe('invalid_client');
    });
  });

  // The provider runs in Node's own realm, and tells no class of the test's
  // (transpiled) from a function: what mountMcp hands it is read instead.
  it('is kept by the adapter mountMcp gives a server that names none', () => {
    const MCP_OAUTH = '../../../packages/server/mcp/mcp-oauth.js';
    let handed;
    let Adapter;
    jest.isolateModules(() => {
      jest.doMock(MCP_OAUTH, () => ({
        ...jest.requireActual(MCP_OAUTH),
        createAuthorizationServer: ({ adapter }) => {
          handed = adapter;
          const Client = function Client() {};
          return { Client, callback: () => () => {} };
        },
      }));
      const { mountMcp } = require('../../../packages/server/mcp/mcp-http.js');
      ({
        McpOAuthAdapter: Adapter,
      } = require('../../../packages/server/mcp/mcp-oauth-adapter.js'));
      mountMcp(require('express')(), {
        origin: oauth.BASE,
        cookieKeys: ['a-test-cookie-key'],
      });
    });
    jest.dontMock(MCP_OAUTH);

    expect(handed).toBe(Adapter);
  });

  // Wherever the authorization server is created, beside its adapter.
  it('is compared by its digest by the authorization server as created', () => {
    const {
      createAuthorizationServer,
    } = require('../../../packages/server/mcp/mcp-oauth.js');
    const {
      secretDigest,
    } = require('../../../packages/server/mcp/mcp-oauth-store.js');
    const provider = createAuthorizationServer({
      issuer: oauth.ISSUER,
      resource: oauth.MCP_RESOURCE,
      cookieKeys: ['a-test-cookie-key'],
      adapter: (name) => new McpOAuthAdapter(name),
    });
    const kept = { clientSecret: secretDigest('a-secret') };
    const { compareClientSecret } = provider.Client.prototype;

    return Promise.all([
      compareClientSecret.call(kept, 'a-secret'),
      compareClientSecret.call(kept, kept.clientSecret),
    ]).then(([presented, digest]) => {
      expect(presented).toBe(true);
      expect(digest).toBe(false);
    });
  });

  it('of a client registered by hand is not kept as it is', async () => {
    const app = oauth.createApp();

    const { body } = await oauth
      .signIn(app, f.ALICE)
      .post(`/api/groups/${f.CLIENT_GROUP}/mcp-clients`)
      .send({ name: 'Copilot Studio', redirectUris: [REDIRECT] });

    expect(body.clientSecret).toEqual(expect.any(String));
    expect(
      JSON.stringify([
        oauth.oauthStore('Client').records,
        oauth.stored('clients'),
      ])
    ).not.toContain(body.clientSecret);
  });
});

describe('a client registered by hand', () => {
  const CLIENTS = `/api/groups/${f.CLIENT_GROUP}/mcp-clients`;
  const REDIRECT = 'https://copilot.example.test/callback';
  let app;
  let created;
  beforeEach(async () => {
    app = oauth.createApp();
    ({ body: created } = await oauth
      .signIn(app, f.TESS)
      .post(CLIENTS)
      .send({ name: 'Copilot Studio', redirectUris: [REDIRECT] }));
  });

  const connect = () =>
    oauth.connect(app, f.FRANK, {
      client: { client_id: created.clientId, redirect_uris: [REDIRECT] },
      group: f.CLIENT_GROUP,
      secret: created.clientSecret,
    });

  // Two independent reads of every call to /mcp: neither waits for the other.
  it('is checked at /mcp while the connection is', async () => {
    const tokens = await connect();
    const {
      McpClients,
      McpConnections,
    } = require('../../../packages/server/common/models.common.js');
    const { findOne } = McpClients;
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const clientRead = jest
      .spyOn(McpClients, 'findOne')
      .mockImplementation((filter, ...rest) => {
        const read = findOne(filter, ...rest);
        if (!filter._company) return read;
        const gated = {
          select: () => gated,
          lean: () => gate.then(() => read.select('_id').lean()),
        };
        return gated;
      });
    const connectionRead = jest.spyOn(McpConnections, 'updateOne');

    const call = oauth.callMcp(app, tokens.access_token).then((r) => r);
    for (let tick = 0; tick < 50 && !connectionRead.mock.calls.length; ) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setImmediate(resolve));
      tick += 1;
    }
    const readMeanwhile = connectionRead.mock.calls.length;
    release();

    expect(readMeanwhile).toBe(1);
    expect((await call).status).toBe(200);
    clientRead.mockRestore();
    connectionRead.mockRestore();
  });

  it("is known by the company's settings alone", async () => {
    const tokens = await connect();

    expect(tokens.access_token).toEqual(expect.any(String));
    expect(oauth.oauthStore('Client').records).toEqual([]);
    expect(oauth.stored('clients')).toEqual([
      expect.objectContaining({
        clientId: created.clientId,
        secretDigest: expect.any(String),
      }),
    ]);
  });

  it('is never kept by the authorization server', async () => {
    const adapter = new McpOAuthAdapter('Client');

    await expect(
      adapter.upsert(created.clientId, { client_id: created.clientId })
    ).rejects.toThrow();
  });

  it('is known no more once deleted, and its connections go', async () => {
    const tokens = await connect();

    await oauth.signIn(app, f.TESS).delete(`${CLIENTS}/${created.clientId}`);

    expect(oauth.stored('clients')).toEqual([]);
    expect(oauth.stored('connections')).toEqual([]);
    expect(oauth.oauthStore('Grant').records).toEqual([]);
    const refreshed = await request(app)
      .post('/oauth/token')
      .type('form')
      .send({
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
        client_id: created.clientId,
        client_secret: created.clientSecret,
      });
    expect(refreshed.body.error).toBe('invalid_client');
    expect((await oauth.callMcp(app, tokens.access_token)).status).toBe(401);
  });

  it("is not another company's to delete", async () => {
    const response = await oauth
      .signIn(app, f.ALICE)
      .delete(`/api/groups/${f.OTHER_GROUP}/mcp-clients/${created.clientId}`);

    expect(response.status).toBe(404);
    expect(oauth.stored('clients')).toHaveLength(1);
  });

  it('serves no company other than its own', async () => {
    const {
      isClientAllowed,
    } = require('../../../packages/server/mcp/mcp-clients.js');

    expect(await isClientAllowed(created.clientId, f.CLIENT_GROUP)).toBe(true);
    expect(await isClientAllowed(created.clientId, f.OTHER_GROUP)).toBe(false);
    expect(await isClientAllowed(created.clientId, 'not-an-id')).toBe(false);
  });
});
