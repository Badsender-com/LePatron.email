'use strict';

// Resetting a password. Asked by the person, the reset keeps the current
// password and the open sessions until the emailed link is used, so asking in
// someone's name locks nobody out. Done by an administrator, it cuts both.

jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue(),
}));

const mongoose = require('mongoose');
const UserSchema = require('../../../packages/server/user/user.schema.js');

const User = mongoose.model('UserResetPasswordTest', UserSchema);

function account() {
  const user = new User({
    email: 'someone@client.test',
    name: 'Someone',
    password: 'current-password',
    activeSessionId: 'open-session',
  });
  user.save = jest.fn().mockResolvedValue(user);
  return user;
}

describe('resetting a password', () => {
  it('keeps the password and the sessions when the person asked', async () => {
    const user = account();

    await user.resetPassword('user', 'en');

    expect(user.comparePassword('current-password')).toBe(true);
    expect(user.activeSessionId).toBe('open-session');
    expect(user.token).toBeTruthy();
  });

  it('cuts the password and ends the sessions when an administrator did', async () => {
    const user = account();

    await user.resetPassword('admin', 'en');

    expect(user.comparePassword('current-password')).toBe(false);
    expect(user.activeSessionId).not.toBe('open-session');
    expect(user.activeSessionId).toBeTruthy();
    expect(user.token).toBeTruthy();
  });
});

describe('the link of the reset email', () => {
  const mail = require('../../../packages/server/mailing/mail.service.js');
  const config = require('../../../packages/server/node.config.js');

  const { isDev } = config;
  afterEach(() => {
    config.isDev = isDev;
  });

  it.each([
    [true, 'http://'],
    [false, 'https://'],
  ])('with isDev %s, starts with %s', async (isDev, scheme) => {
    config.isDev = isDev;

    await account().resetPassword('user', 'en');

    const { text } = mail.send.mock.calls[mail.send.mock.calls.length - 1][0];
    expect(text).toContain(`${scheme}${config.host}/account/`);
  });
});
