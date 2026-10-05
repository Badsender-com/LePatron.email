'use strict';

// The public account endpoints answer the same whether or not the email has
// an account: the email itself is where the difference goes. Along with the
// rate limits of account.routes.js, this keeps the login page from telling
// which emails exist and the reset from flooding an inbox.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOne: jest.fn() },
  Groups: { findOne: jest.fn() },
  Mailings: {},
}));
jest.mock('../../../packages/server/user/user.service.js', () => ({}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Users,
  Groups,
} = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/user/user.controller.js');

function call(handler, params) {
  return new Promise((resolve) => {
    const res = { json: (payload) => resolve({ status: 200, body: payload }) };
    handler({ params, body: {}, query: {} }, res, (err) =>
      resolve({ status: err.status, error: err.message })
    );
  });
}

describe('forgotten password', () => {
  it('sends the email and answers nothing about the account', async () => {
    const resetPassword = jest.fn().mockResolvedValue();
    Users.findOne.mockResolvedValue({ _id: 'u1', lang: 'fr', resetPassword });

    const result = await call(controller.forgotPassword, {
      email: 'known@client.test',
    });

    expect(result).toEqual({ status: 200, body: {} });
    await new Promise((resolve) => setImmediate(resolve));
    expect(resetPassword).toHaveBeenCalled();
  });

  it('answers the same for an unknown email', async () => {
    Users.findOne.mockResolvedValue(null);

    const result = await call(controller.forgotPassword, {
      email: 'nobody@client.test',
    });

    expect(result).toEqual({ status: 200, body: {} });
  });
});

describe('public profile', () => {
  it('reads a known email as how it signs in, nothing more', async () => {
    Users.findOne.mockResolvedValue({ _id: 'u1', group: 'g1', name: 'Known' });
    Groups.findOne.mockResolvedValue({ name: 'Client' });

    const result = await call(controller.getPublicProfile, {
      username: 'Known@Client.test',
    });

    expect(result).toEqual({
      status: 200,
      body: { group: { isSAMLAuthentication: false } },
    });
    expect(Users.findOne.mock.calls[0][0].email).toBe('known@client.test');
  });

  it('reads an unknown email like an account signing in with a password', async () => {
    Users.findOne.mockResolvedValue(null);

    const result = await call(controller.getPublicProfile, {
      username: 'nobody@client.test',
    });

    expect(result).toEqual({
      status: 200,
      body: { group: { isSAMLAuthentication: false } },
    });
  });
});
