'use strict';

// Shared by the quality resources tests (quality-resources.*.test.js): the
// mocked collaborators, the injected dependencies of a run, and a run of
// user u1 in company c1.
//
// Required before anything it mocks: the jest.mock calls below register on the
// test's module registry when this file loads.

jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
}));
// The Web Risk budget lives in the database (quality-threats.test.js); here
// every dependency is injected, and the bounds log stays out of the output.
jest.mock('../../../packages/server/common/models.common.js', () => ({
  QualityBudgets: { findOneAndUpdate: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  checkResources,
  clearCacheForTests,
} = require('../../../packages/server/mailing/quality-resources.service.js');

const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

function deps(overrides = {}) {
  return {
    probe: jest.fn(async () => ({ status: 200, body: ONE_PIXEL_PNG })),
    fetchOwn: jest.fn(async () => ({ status: 200, body: ONE_PIXEL_PNG })),
    resolve4: jest.fn(async () => {
      const error = new Error('queryA ENOTFOUND');
      error.code = 'ENOTFOUND';
      throw error;
    }),
    zones: () => [],
    webRiskKey: () => null,
    webRiskLookup: jest.fn(),
    spendWebRiskLookup: jest.fn(async () => true),
    ...overrides,
  };
}

const run = (resources, d, context = {}) =>
  checkResources(
    { links: [], images: [], ...resources },
    { userKey: 'u1', cacheScope: 'c1', ownHosts: ['app.test'], ...context },
    d
  );

/** Caches, queues and mocks emptied: for each test's `beforeEach`. */
function resetQuality() {
  clearCacheForTests();
  jest.resetAllMocks();
}

module.exports = { ONE_PIXEL_PNG, deps, run, resetQuality };
