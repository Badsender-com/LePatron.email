/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// The store of the authorization server (ADR 0012): the adapter `oidc-provider`
// reads and writes through, over the driver's collections, as MongoDB before
// 5.0 answers them (fake-mongo-collection.js). The OAuth suites drive the
// provider over it too; this one holds it to what the provider expects.

const mongoose = require('mongoose');
const { createFakeDb } = require('../../helpers/fake-mongo-collection');

jest.doMock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

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
    await adapter.upsert('a-code', accessToken({ kind: 'AuthorizationCode' }));

    await adapter.consume('a-code');

    expect(await adapter.find('a-code')).toMatchObject({
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
