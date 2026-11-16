'use strict';

// What the authorization server's events leave in the logs (ADR 0012): its
// detail bounded to one short line, whatever a request carried into it.

jest.doMock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
}));

const { EventEmitter } = require('events');
const logger = require('../../../packages/server/utils/logger.js');
const {
  logAuthorizationServer,
} = require('../../../packages/server/mcp/mcp-oauth-log.js');

describe('the log of a refused token request', () => {
  let provider;
  beforeEach(() => {
    provider = new EventEmitter();
    logAuthorizationServer(provider);
    logger.warn.mockClear();
  });

  const ctx = { oidc: { client: { clientId: 'a-client' }, entities: {} } };

  it('keeps its detail to one bounded line', () => {
    const detail = `origin ${'x'.repeat(5000)}\nforged line`;

    provider.emit('grant.error', ctx, { error_detail: detail });

    const [line] = logger.warn.mock.calls[0];
    expect(line).not.toMatch(/[\r\n]/);
    expect(line.length).toBeLessThan(400);
    expect(line).toContain('a-client');
  });

  it('names no grant when the request had none', () => {
    provider.emit('grant.error', ctx, { message: 'invalid_grant' });

    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('client a-client, grant none')
    );
  });
});
