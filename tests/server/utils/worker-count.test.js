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

  it('falls back to one worker above the CPU count, or without a value', () => {
    expect(workerCount({ workers: '64', cpuCount: 4 })).toBe(1);
    expect(workerCount({ workers: undefined, cpuCount: 4 })).toBe(1);
    expect(workerCount({ workers: 'many', cpuCount: 4 })).toBe(1);
  });

  it('keeps what index.js always did with zero', () => {
    expect(workerCount({ workers: '0', cpuCount: 4 })).toBe(0);
  });
});
