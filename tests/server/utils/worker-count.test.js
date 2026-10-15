'use strict';

// One reading of WORKERS for the cluster and for the bounds it reports.

const {
  workerCount,
} = require('../../../packages/server/utils/worker-count.js');

describe('workerCount', () => {
  it('takes WORKERS up to the CPU count', () => {
    expect(workerCount({ workers: '3', cpuCount: 4 })).toBe(3);
    expect(workerCount({ workers: '4', cpuCount: 4 })).toBe(4);
  });

  it('falls back to one worker above the CPU count, or without a number', () => {
    expect(workerCount({ workers: '8', cpuCount: 4 })).toBe(1);
    for (const workers of [undefined, '', '0', 'many']) {
      expect(workerCount({ workers, cpuCount: 4 })).toBe(1);
    }
  });
});
