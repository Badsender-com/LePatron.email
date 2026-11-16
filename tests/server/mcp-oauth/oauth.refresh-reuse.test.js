/**
 * @jest-environment ./tests/helpers/node-globals-environment.js
 */
'use strict';

// A refresh token already used (ADR 0012): a client may send the refresh
// token it just traded once more, when two of its requests go at once, or
// when it retries an answer it lost. Within a minute of its first use, that
// is a client's, not a thief's.

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

  it('gives a new access token again, within a minute of its first use', async () => {
    const first = await connect();
    await refresh(first.refresh_token);
    later(10);

    const again = await refresh(first.refresh_token);

    expect(again.status).toBe(200);
    expect(again.body.access_token).toEqual(expect.any(String));
    expect(again.body.refresh_token).not.toBe(first.refresh_token);
  });

  it('keeps the connection open to the refresh token it traded first', async () => {
    const first = await connect();
    const traded = (await refresh(first.refresh_token)).body;
    later(10);
    await refresh(first.refresh_token);

    const response = await refresh(traded.refresh_token);

    expect(response.status).toBe(200);
  });

  it('refuses it past the minute, and ends the connection', async () => {
    const first = await connect();
    const traded = (await refresh(first.refresh_token)).body;
    later(61);

    const again = await refresh(first.refresh_token);
    const after = await refresh(traded.refresh_token);

    expect(again.body.error).toBe('invalid_grant');
    expect(after.body.error).toBe('invalid_grant');
  });

  it('counts the minute from its first use, not from a retry', async () => {
    const first = await connect();
    await refresh(first.refresh_token);
    later(50);
    await refresh(first.refresh_token);
    later(20);

    const again = await refresh(first.refresh_token);

    expect(again.body.error).toBe('invalid_grant');
  });

  it('logs why it refused it', async () => {
    const first = await connect();
    await refresh(first.refresh_token);
    later(61);

    await refresh(first.refresh_token);

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('refresh token already used')
    );
  });
});
