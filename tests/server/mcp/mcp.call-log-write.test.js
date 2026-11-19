'use strict';

// The call log is written in the background (ADR 0012): whatever becomes of
// a write, the call has answered already, and what waits for the writes, the
// stop of a server included, goes on.

const mockCreate = jest.fn();
jest.mock('../../../packages/server/common/models.common.js', () => ({
  McpCallLogs: { create: (...args) => mockCreate(...args) },
  Groups: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const {
  recordCall,
  callLogsWritten,
  callsAndLogsDone,
} = require('../../../packages/server/mcp/mcp-call-log.js');

const IDENTITY = { group: { logRetentionDays: 30 } };
const ENTRY = { _company: 'g1', method: 'tools/call', outcome: 'ok' };

describe('a call log that cannot be written', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    logger.error.mockReset();
  });

  it('is logged, and nothing waits for it any more', async () => {
    mockCreate.mockRejectedValue(new Error('database down'));
    // Even the log of the failure fails, once.
    logger.error.mockImplementationOnce(() => {
      throw new Error('logger down');
    });

    recordCall(ENTRY, IDENTITY);

    await expect(callLogsWritten()).resolves.toBeUndefined();
    await expect(callsAndLogsDone({ pollMs: 1 })).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenLastCalledWith(
      '[mcp] the call log failed',
      'logger down'
    );
  });

  it('is written otherwise', async () => {
    mockCreate.mockResolvedValue({});

    recordCall(ENTRY, IDENTITY);
    await callLogsWritten();

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({ ...ENTRY, expiresAt: expect.any(Date) })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });
});
