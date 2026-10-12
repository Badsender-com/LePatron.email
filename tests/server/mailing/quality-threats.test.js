'use strict';

// The Web Risk budget is the one quality bound that costs money: it is kept
// in the database so that every worker of the cluster draws on the same one.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  QualityBudgets: { findOneAndUpdate: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const logger = require('../../../packages/server/utils/logger.js');
const {
  QualityBudgets,
} = require('../../../packages/server/common/models.common.js');
const {
  spendWebRiskLookup,
  WEB_RISK_LOOKUPS_PER_DAY,
} = require('../../../packages/server/mailing/quality-threats.service.js');

const duplicateKey = () =>
  Object.assign(new Error('E11000 duplicate key'), { code: 11000 });

beforeEach(() => {
  jest.clearAllMocks();
});

describe('spendWebRiskLookup', () => {
  it("counts one lookup on the company's day, only while under the limit", async () => {
    QualityBudgets.findOneAndUpdate.mockResolvedValue({});
    const now = new Date('2026-10-12T23:30:00Z');

    await expect(spendWebRiskLookup('c1', now)).resolves.toBe(true);

    const [
      filter,
      update,
      options,
    ] = QualityBudgets.findOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({
      scope: 'c1',
      kind: 'webrisk',
      day: '2026-10-12',
      count: { $lt: WEB_RISK_LOOKUPS_PER_DAY },
    });
    expect(update.$inc).toEqual({ count: 1 });
    // The day's document goes by itself once it is old news.
    expect(update.$setOnInsert.expiresAt.getTime()).toBeGreaterThan(
      new Date('2026-10-13T00:00:00Z').getTime()
    );
    expect(options).toEqual({ upsert: true });
  });

  it('answers "spent" when the day is at its limit', async () => {
    // Nothing under the limit to update: the upsert meets the day's document.
    QualityBudgets.findOneAndUpdate.mockRejectedValue(duplicateKey());
    await expect(spendWebRiskLookup('c1')).resolves.toBe(false);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('tries again once when two workers open the same day together', async () => {
    QualityBudgets.findOneAndUpdate
      .mockRejectedValueOnce(duplicateKey())
      .mockResolvedValueOnce({});
    await expect(spendWebRiskLookup('c1')).resolves.toBe(true);
    expect(QualityBudgets.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('spends nothing when the database does not answer', async () => {
    QualityBudgets.findOneAndUpdate.mockRejectedValue(
      Object.assign(new Error('connection lost at mongodb://user:pw@db'), {
        name: 'MongoNetworkError',
        code: 'ECONNRESET',
      })
    );
    await expect(spendWebRiskLookup('c1')).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledWith(expect.any(String), {
      error: 'MongoNetworkError',
      code: 'ECONNRESET',
    });
    expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('user:pw');
  });
});
