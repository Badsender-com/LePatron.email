'use strict';

// The ways in are the password and the SSO. A strategy registered without
// a route that uses it is a way in nobody reviews: one added fails here.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: {},
  Groups: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const passport = require('passport');

require('../../../packages/server/account/auth.guard.js');

describe('the passport strategies', () => {
  it('are the password and the SSO, besides the session', () => {
    expect(Object.keys(passport._strategies).sort()).toEqual([
      'local',
      'saml',
      'session',
    ]);
  });
});
