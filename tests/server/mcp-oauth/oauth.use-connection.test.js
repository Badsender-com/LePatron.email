'use strict';

// Whether a connection still stands, as `/mcp` asks at every call
// (mcp-connections.js), read through the real Mongoose 5 model: the driver
// alone is stubbed, answering an update as mongodb 3.6 does. Mongoose 5 hands
// back the server's `result` (`{ n, nModified, ok }`), never `matchedCount`,
// which the fake models of the other suites only imitate.

jest.doMock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const {
  McpConnections,
} = require('../../../packages/server/common/models.common.js');
const {
  useConnection,
} = require('../../../packages/server/mcp/mcp-connections.js');

// What mongodb 3.6 answers to an update that matched `n` documents.
const driverAnswer = (n) => ({
  result: { n, nModified: n, ok: 1 },
  matchedCount: n,
  modifiedCount: n,
  upsertedCount: 0,
  upsertedId: null,
});

describe('a connection in use', () => {
  let updateOne;
  beforeEach(() => {
    updateOne = jest
      .spyOn(McpConnections.collection, 'updateOne')
      .mockImplementation(() => {
        throw new Error('stub the answer');
      });
  });
  afterEach(() => updateOne.mockRestore());

  const answering = (n) =>
    updateOne.mockImplementation((filter, update, options, callback) =>
      callback(null, driverAnswer(n))
    );

  it('stands while its record does', async () => {
    answering(1);

    expect(await useConnection('a-standing-grant')).toBe(true);
    expect(updateOne).toHaveBeenCalledWith(
      { grantId: 'a-standing-grant' },
      { $set: { lastUsedAt: expect.any(Date) } },
      expect.anything(),
      expect.any(Function)
    );
  });

  it('is revoked once its record is gone', async () => {
    answering(0);

    expect(await useConnection('a-revoked-grant')).toBe(false);
  });
});
