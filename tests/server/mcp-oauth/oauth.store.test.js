/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The store of the authorization server (ADR 0012): the adapter `oidc-provider`
// reads and writes through, over the driver's collections, as MongoDB before
// 5.0 answers them (fake-mongo-collection.js). The OAuth suites drive the
// provider over it too; this one holds it to what the provider expects.

const mongoose = require('mongoose');
const request = require('../../helpers/local-request');
const oauth = require('../../helpers/mcp-oauth-harness');
const f = require('../../helpers/mcp-fixtures');
const { createFakeDb } = require('../../helpers/fake-mongo-collection');

const {
  McpOAuthAdapter,
} = require('../../../packages/server/mcp/mcp-oauth-adapter.js');

const RESOURCE = 'https://lepatron.example.test/mcp';
const NOW = Math.floor(Date.now() / 1000);

let db;
beforeEach(() => {
  db = createFakeDb();
  mongoose.connection.db = db;
});

const stored = (model) =>
  db.collection(`mcp_oauth_${model.toLowerCase()}`).records;

const accessToken = (overrides = {}) => ({
  iat: NOW,
  exp: NOW + 3600,
  jti: 'an-access-token',
  kind: 'AccessToken',
  clientId: 'a-client',
  grantId: 'grant-1',
  accountId: 'user.group',
  scope: 'mcp:read',
  aud: RESOURCE,
  ...overrides,
});

describe('the adapter of the authorization server', () => {
  it('answers a payload as it was given', async () => {
    const adapter = new McpOAuthAdapter('AccessToken');

    await adapter.upsert('an-access-token', accessToken(), 3600);

    expect(await adapter.find('an-access-token')).toEqual(accessToken());
  });

  it.each(['AccessToken', 'RefreshToken', 'AuthorizationCode'])(
    'keeps a %s under its digest, and finds it by its value',
    async (model) => {
      const adapter = new McpOAuthAdapter(model);
      const payload = accessToken({ kind: model });

      await adapter.upsert('an-access-token', payload, 3600);

      expect(JSON.stringify(stored(model))).not.toContain('an-access-token');
      expect(await adapter.find('an-access-token')).toEqual(payload);
      expect(await adapter.find(stored(model)[0]._id)).toBeUndefined();
    }
  );

  it('keeps the id of a grant as it is, for the tokens it issued to name it', async () => {
    const adapter = new McpOAuthAdapter('Grant');

    await adapter.upsert('grant-1', { jti: 'grant-1', kind: 'Grant' }, 60);

    expect(stored('Grant')[0]._id).toBe('grant-1');
  });

  it('answers nothing for a record it does not have', async () => {
    const adapter = new McpOAuthAdapter('AccessToken');

    expect(await adapter.find('unknown')).toBeUndefined();
  });

  it('dates the record for the TTL index to remove it', async () => {
    const adapter = new McpOAuthAdapter('AccessToken');
    const before = Date.now();

    await adapter.upsert('an-access-token', accessToken(), 3600);

    const [record] = stored('AccessToken');
    expect(record.expiresAt).toBeInstanceOf(Date);
    expect(record.expiresAt.getTime()).toBeGreaterThanOrEqual(
      before + 3600 * 1000
    );
    expect(db.collection('mcp_oauth_accesstoken').indexes).toContainEqual({
      keys: { expiresAt: 1 },
      options: { expireAfterSeconds: 0 },
    });
  });

  it('keeps a client that registered for as long as it is told', async () => {
    const adapter = new McpOAuthAdapter('Client');

    await adapter.upsert('a-client', { client_id: 'a-client' });
    expect(stored('Client')[0].expiresAt).toBeUndefined();

    await adapter.upsert('a-client', { client_id: 'a-client' }, 60);
    expect(stored('Client')[0].expiresAt).toBeInstanceOf(Date);
  });

  // A grant names its resource by its URL, a key MongoDB before 5.0 does
  // not store.
  it('keeps a grant whose resource is a URL', async () => {
    const adapter = new McpOAuthAdapter('Grant');
    const grant = {
      iat: NOW,
      exp: NOW + 3600,
      jti: 'grant-1',
      kind: 'Grant',
      accountId: 'user.group',
      clientId: 'a-client',
      openid: { scope: 'mcp:read' },
      resources: { [RESOURCE]: 'mcp:read' },
    };

    await adapter.upsert('grant-1', grant, 3600);

    expect(await adapter.find('grant-1')).toEqual(grant);
  });

  it('marks a code consumed', async () => {
    const adapter = new McpOAuthAdapter('AuthorizationCode');
    await adapter.upsert(
      'a-code',
      accessToken({ jti: 'a-code', kind: 'AuthorizationCode' })
    );

    await adapter.consume('a-code');

    expect(await adapter.find('a-code')).toMatchObject({
      jti: 'a-code',
      consumed: expect.any(Number),
    });
  });

  it('destroys a record', async () => {
    const adapter = new McpOAuthAdapter('AccessToken');
    await adapter.upsert('an-access-token', accessToken(), 3600);

    await adapter.destroy('an-access-token');

    expect(await adapter.find('an-access-token')).toBeUndefined();
    expect(stored('AccessToken')).toEqual([]);
  });

  it('finds a session by its uid', async () => {
    const adapter = new McpOAuthAdapter('Session');
    const session = {
      iat: NOW,
      exp: NOW + 3600,
      jti: 'a-session',
      kind: 'Session',
      uid: 'a-uid',
      accountId: 'user.group',
    };
    await adapter.upsert('a-session', session, 3600);

    expect(await adapter.findByUid('a-uid')).toEqual(session);
    expect(await adapter.findByUid('another-uid')).toBeUndefined();
  });

  it("revokes what a grant issued, and only that grant's", async () => {
    const adapter = new McpOAuthAdapter('RefreshToken');
    await adapter.upsert('refresh-1', accessToken({ jti: 'refresh-1' }), 60);
    await adapter.upsert(
      'refresh-2',
      accessToken({ jti: 'refresh-2', grantId: 'grant-2' }),
      60
    );

    await adapter.revokeByGrantId('grant-1');

    expect(await adapter.find('refresh-1')).toBeUndefined();
    expect(await adapter.find('refresh-2')).toEqual(
      accessToken({ jti: 'refresh-2', grantId: 'grant-2' })
    );
  });

  it('creates its indexes again after a failure', async () => {
    const collection = db.collection('mcp_oauth_refreshtoken');
    const createIndex = jest
      .spyOn(collection, 'createIndex')
      .mockRejectedValueOnce(new Error('not primary'));
    const adapter = new McpOAuthAdapter('RefreshToken');

    await adapter.upsert('refresh-1', accessToken({ jti: 'refresh-1' }), 60);
    const tried = createIndex.mock.calls.length;
    await adapter.find('refresh-1');

    expect(createIndex.mock.calls.length).toBeGreaterThan(tried);
    expect(collection.indexes).toContainEqual({
      keys: { expiresAt: 1 },
      options: { expireAfterSeconds: 0 },
    });
  });

  it('creates its indexes once they are made', async () => {
    const collection = db.collection('mcp_oauth_refreshtoken');
    const createIndex = jest.spyOn(collection, 'createIndex');
    const adapter = new McpOAuthAdapter('RefreshToken');

    await adapter.upsert('refresh-1', accessToken({ jti: 'refresh-1' }), 60);
    const made = createIndex.mock.calls.length;
    await adapter.find('refresh-1');

    expect(createIndex.mock.calls.length).toBe(made);
  });
});

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
