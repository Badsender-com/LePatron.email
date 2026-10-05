'use strict';

// Signing in with a password. An unknown email and a wrong password get the
// same answer, and a pending reset asked in someone's name bars nobody: the
// current password keeps working until the emailed link is used.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOne: jest.fn() },
  Groups: {},
  OAuthClients: {},
  OAuthTokens: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const passport = require('passport');
const bcrypt = require('bcryptjs');

const { Users } = require('../../../packages/server/common/models.common.js');
require('../../../packages/server/account/auth.guard.js');

const HASH = bcrypt.hashSync('right-password', 4);

function account(overrides) {
  return {
    id: 'u1',
    email: 'someone@client.test',
    password: HASH,
    comparePassword(password) {
      return !!this.password && bcrypt.compareSync(password, this.password);
    },
    ...overrides,
  };
}

function signIn(username, password) {
  return new Promise((resolve) => {
    passport
      ._strategy('local')
      ._verify(username, password, (err, user, info) =>
        resolve({ err, user, info })
      );
  });
}

beforeEach(() => jest.clearAllMocks());

describe('signing in with a password', () => {
  it('lets the right password in', async () => {
    Users.findOne.mockResolvedValue(account());

    const { user } = await signIn('someone@client.test', 'right-password');

    expect(user.id).toBe('u1');
  });

  it('refuses a wrong password', async () => {
    Users.findOne.mockResolvedValue(account());

    const { user, info } = await signIn('someone@client.test', 'wrong');

    expect(user).toBe(false);
    expect(info).toEqual({ message: 'password.error.incorrect' });
  });

  it('refuses an unknown email with the same answer', async () => {
    Users.findOne.mockResolvedValue(null);

    const { user, info } = await signIn('nobody@client.test', 'anything');

    expect(user).toBe(false);
    expect(info).toEqual({ message: 'password.error.incorrect' });
  });

  it('still lets the current password in while a reset is pending', async () => {
    Users.findOne.mockResolvedValue(
      account({ token: 'pending', tokenExpire: new Date(Date.now() + 1000) })
    );

    const { user } = await signIn('someone@client.test', 'right-password');

    expect(user.id).toBe('u1');
    expect(Users.findOne.mock.calls[0][0]).not.toHaveProperty('token');
  });

  it('refuses an account without a password, invited or reset by an admin', async () => {
    Users.findOne.mockResolvedValue(account({ password: undefined }));

    const { user, info } = await signIn('someone@client.test', 'anything');

    expect(user).toBe(false);
    expect(info).toEqual({ message: 'password.error.incorrect' });
  });
});
