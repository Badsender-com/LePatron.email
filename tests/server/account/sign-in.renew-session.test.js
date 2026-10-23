'use strict';

// Every sign-in opens a new session, with a new id: the session a browser
// held before signing in, and what it carried (the step of the code), is
// never the signed-in one.

const harness = require('../../helpers/two-factor-harness.js');

jest.mock('passport', () => ({ authenticate: jest.fn() }));
jest.mock(
  '../../../packages/server/common/models.common.js',
  () => require('../../helpers/two-factor-harness.js').models
);
jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue({}),
}));
jest.mock(
  '../../../packages/server/account/session-tracking.helper.js',
  () => ({ updateSessionTracking: jest.fn() })
);
jest.mock('../../../packages/server/account/selected-group.js', () => ({
  resolveSelectedGroup: jest.fn().mockResolvedValue(null),
  forgetSessionSelection: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const passport = require('passport');
const users = require('../../../packages/server/user/user.controller.js');
const twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
const {
  renewSessionFirst,
} = require('../../../packages/server/account/sign-in.js');

beforeEach(() => {
  harness.reset();
  jest.spyOn(Date, 'now').mockImplementation(() => harness.RFC_TIME);
});

afterEach(() => jest.restoreAllMocks());

describe('a sign-in opens a new session', () => {
  it('with the password alone', async () => {
    harness.addGroup({ requireTwoFactor: false });
    const before = {};

    const { req } = await harness.signIn(passport, harness.addUser(), {
      session: before,
    });

    expect(req.logIn).toHaveBeenCalled();
    expect(req.session).not.toBe(before);
    expect(req.sessionID).not.toBe('new-session');
  });

  it('after the code, never the session of the step', async () => {
    harness.addGroup({ requireTwoFactor: true });
    const { req: password } = await harness.signIn(
      passport,
      harness.addTotpUser()
    );
    const step = password.session;
    const code = harness.makeRequest({
      session: step,
      body: { code: harness.RFC_CODE },
    });

    await harness.call(twoFactor.verify, code);

    expect(code.logIn).toHaveBeenCalled();
    expect(code.session).not.toBe(step);
  });

  it('from the emailed password link', async () => {
    harness.addGroup({ requireTwoFactor: false });
    harness.addUser({ token: 'emailed-token' });
    const before = {};
    const req = harness.makeRequest({
      session: before,
      params: { email: 'camille@client.test', token: 'emailed-token' },
      body: { password: 'new-password', passwordConfirm: 'new-password' },
    });

    await harness.call(users.setPassword, req);

    expect(req.login).toHaveBeenCalled();
    expect(req.session).not.toBe(before);
  });

  it('before passport opens one itself, on the SSO callback', async () => {
    const before = {};
    const req = harness.makeRequest({ session: before });
    const next = jest.fn();

    await new Promise((resolve) =>
      renewSessionFirst(req, {}, (error) => resolve(next(error)))
    );

    expect(next).toHaveBeenCalledWith(undefined);
    expect(req.session).not.toBe(before);
  });
});
