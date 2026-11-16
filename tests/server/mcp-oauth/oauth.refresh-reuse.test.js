/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A refresh token already used (ADR 0012): a client may send the refresh
// token it just traded once more, when two of its requests go at once, or
// when it retries an answer it lost. Within 30 seconds of its first use,
// that is a client's, not a thief's: the retries seen came 10 seconds after.

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
const {
  McpOAuthAdapter,
} = require('../../../packages/server/mcp/mcp-oauth-adapter.js');

const { CIMD_CLIENT, MCP_RESOURCE } = oauth;

describe('a refresh token already used', () => {
  let app;
  let now;
  beforeEach(() => {
    app = oauth.createApp();
    now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    logger.warn.mockClear();
  });
  afterEach(() => jest.restoreAllMocks());
  const later = (seconds) => {
    now += seconds * 1000;
  };

  const connect = () => oauth.connect(app, f.FRANK, { group: f.CLIENT_GROUP });

  const refresh = (refreshToken) =>
    request(app).post('/oauth/token').type('form').send({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: CIMD_CLIENT.client_id,
      resource: MCP_RESOURCE,
    });

  it('gives a new access token again, within 30 seconds of its first use', async () => {
    const first = await connect();
    await refresh(first.refresh_token);
    later(10);

    const again = await refresh(first.refresh_token);

    expect(again.status).toBe(200);
    expect(again.body.access_token).toEqual(expect.any(String));
    expect(again.body.refresh_token).not.toBe(first.refresh_token);
  });

  it('keeps the connection open to both refresh tokens it traded', async () => {
    const first = await connect();
    const traded = (await refresh(first.refresh_token)).body;
    later(10);
    const retraded = (await refresh(first.refresh_token)).body;

    expect((await refresh(traded.refresh_token)).status).toBe(200);
    expect((await refresh(retraded.refresh_token)).status).toBe(200);
  });

  it('refuses it past 30 seconds, and ends the connection', async () => {
    const first = await connect();
    const traded = (await refresh(first.refresh_token)).body;
    later(31);

    const again = await refresh(first.refresh_token);
    const after = await refresh(traded.refresh_token);

    expect(again.body.error).toBe('invalid_grant');
    expect(after.body.error).toBe('invalid_grant');
  });

  it('refuses it a second time, and ends the connection', async () => {
    const first = await connect();
    const traded = (await refresh(first.refresh_token)).body;
    later(5);
    const retraded = (await refresh(first.refresh_token)).body;
    later(5);

    const again = await refresh(first.refresh_token);

    expect(again.body.error).toBe('invalid_grant');
    expect((await refresh(traded.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
    expect((await refresh(retraded.refresh_token)).body.error).toBe(
      'invalid_grant'
    );
  });

  it('logs why it refused it', async () => {
    const first = await connect();
    await refresh(first.refresh_token);
    later(31);

    await refresh(first.refresh_token);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('refresh token already used')
    );
  });
});

// The adapter holds the count, whatever the order the provider's reads and
// writes of requests sent at once come in.
describe('the count of the uses of a refresh token', () => {
  let now;
  beforeEach(() => {
    oauth.createApp();
    now = Date.now();
    jest.spyOn(Date, 'now').mockImplementation(() => now);
  });
  afterEach(() => jest.restoreAllMocks());

  const refreshToken = async () => {
    const adapter = new McpOAuthAdapter('RefreshToken');
    await adapter.upsert(
      'a-refresh-token',
      { kind: 'RefreshToken', clientId: 'a-client', grantId: 'a-grant' },
      3600
    );
    return adapter;
  };

  // Three requests at once all read it before any of them traded it.
  it('refuses a third trade of requests sent at once', async () => {
    const adapter = await refreshToken();
    await adapter.find('a-refresh-token');
    await adapter.consume('a-refresh-token');
    await adapter.consume('a-refresh-token');

    await expect(adapter.consume('a-refresh-token')).rejects.toMatchObject({
      error: 'invalid_grant',
    });
  });

  it('keeps the time of its first use when it is traded again', async () => {
    const adapter = await refreshToken();
    const [stored] = oauth.oauthStore('RefreshToken').records;
    await adapter.consume('a-refresh-token');
    const firstUse = stored.consumed;
    now += 20 * 1000;
    await adapter.consume('a-refresh-token');

    expect(firstUse).toBe(Math.floor((now - 20 * 1000) / 1000));
    expect(stored.consumed).toBe(firstUse);
  });
});
