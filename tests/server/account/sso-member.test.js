'use strict';

// A member of a group with SSO signs in through its identity provider only:
// no password sign-in, no password reset, no session from an emailed link,
// so the identity provider's rules (its second factor, a departure) hold in
// LePatron too.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOne: jest.fn(), findOneForApi: jest.fn() },
  Groups: { findOne: jest.fn() },
  Mailings: {},
  OAuthClients: {},
  OAuthTokens: {},
}));
jest.mock('../../../packages/server/user/user.service.js', () => ({}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const passport = require('passport');
const bcrypt = require('bcryptjs');

const {
  Users,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/user/user.controller.js');
require('../../../packages/server/account/auth.guard.js');

const GROUP_ID = '507f1f77bcf86cd799439b01';
const SSO = {
  entryPoint: 'https://idp.client.test/sso',
  issuer: 'lepatron',
  idpCert: 'MIIC-certificate',
};

function account(overrides) {
  return {
    _id: 'u1',
    id: 'u1',
    email: 'someone@client.test',
    _company: GROUP_ID,
    password: bcrypt.hashSync('right-password', 4),
    token: 'emailed-token',
    lang: 'fr',
    save: jest.fn().mockResolvedValue(),
    resetPassword: jest.fn().mockResolvedValue(),
    setPassword: jest.fn().mockResolvedValue(),
    ...overrides,
  };
}

function signIn(password) {
  return new Promise((resolve) => {
    passport
      ._strategy('local')
      ._verify('someone@client.test', password, (err, user, info) =>
        resolve({ err, user, info })
      );
  });
}

function call(handler, params, body = {}) {
  return new Promise((resolve) => {
    const req = { params, body, query: {}, login: jest.fn((u, cb) => cb()) };
    const res = { json: (payload) => resolve({ status: 200, body: payload }) };
    handler(req, res, (err) =>
      resolve({ status: err.status, error: err.message })
    );
  });
}

beforeEach(() => jest.clearAllMocks());

describe('a member of a group with SSO', () => {
  beforeEach(() => Groups.findOne.mockResolvedValue({ _id: GROUP_ID, ...SSO }));

  it('cannot sign in with a password, even the right one', async () => {
    Users.findOne.mockResolvedValue(account());

    const { user, info } = await signIn('right-password');

    expect(user).toBe(false);
    expect(info).toEqual({ message: 'password.error.incorrect' });
  });

  it('gets no password reset email, and the same answer as anyone', async () => {
    const member = account();
    Users.findOne.mockResolvedValue(member);

    const result = await call(controller.forgotPassword, {
      email: 'someone@client.test',
    });

    expect(result).toEqual({ status: 200, body: {} });
    await new Promise((resolve) => setImmediate(resolve));
    expect(member.resetPassword).not.toHaveBeenCalled();
  });

  it('gets no password and no session from a link left from before the SSO', async () => {
    const member = account();
    Users.findOne.mockResolvedValue(member);

    const result = await call(
      controller.setPassword,
      { email: 'someone@client.test', token: 'emailed-token' },
      { password: 'new-password', passwordConfirm: 'new-password' }
    );

    expect(result.status).toBe(400);
    expect(member.setPassword).not.toHaveBeenCalled();
  });
});

describe('a member of a group whose SSO is not usable', () => {
  it('signs in with a password: no certificate, no SSO', async () => {
    Groups.findOne.mockResolvedValue({
      _id: GROUP_ID,
      entryPoint: SSO.entryPoint,
      issuer: SSO.issuer,
    });
    Users.findOne.mockResolvedValue(account());

    const { user } = await signIn('right-password');

    expect(user.id).toBe('u1');
  });
});
