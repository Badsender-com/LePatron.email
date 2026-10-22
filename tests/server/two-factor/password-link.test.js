'use strict';

// The emailed password link (epic #1318, ADR 0008). It opened a session by
// itself; for a member whose group requires two-factor authentication, the
// mailbox alone must not open the account, so the link only sets the
// password and the member signs in as usual.

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

const { RFC_CODE, RFC_TIME } = harness;

function followLink(options = {}) {
  return harness.call(
    users.setPassword,
    harness.makeRequest({
      params: { email: 'camille@client.test', token: 'emailed-token' },
      body: { password: 'new-password', passwordConfirm: 'new-password' },
      ...options,
    })
  );
}

beforeEach(() => {
  harness.reset();
  jest.spyOn(Date, 'now').mockImplementation(() => RFC_TIME);
});

afterEach(() => jest.restoreAllMocks());

// Turned on by #1320 (two-factor authentication with an authenticator app)
describe.skip('the password link of a member who needs two-factor authentication', () => {
  it('sets the password but opens no session', async () => {
    harness.addGroup({ requireTwoFactor: true });
    harness.addTotpUser({ token: 'emailed-token' });
    const req = harness.makeRequest({
      params: { email: 'camille@client.test', token: 'emailed-token' },
      body: { password: 'new-password', passwordConfirm: 'new-password' },
    });

    const { body } = await harness.call(users.setPassword, req);

    expect(body).toEqual({ twoFactorRequired: true });
    expect(req.login).not.toHaveBeenCalled();
  });

  it('opens no session for a member who has not set it up yet either', async () => {
    harness.addGroup({ requireTwoFactor: true });
    harness.addUser({ token: 'emailed-token' });

    const { body } = await followLink();

    expect(body).toEqual({ twoFactorRequired: true });
  });

  it('still opens the session for a member of a group that does not require it', async () => {
    harness.addGroup({ requireTwoFactor: false });
    harness.addUser({ token: 'emailed-token' });
    const req = harness.makeRequest({
      params: { email: 'camille@client.test', token: 'emailed-token' },
      body: { password: 'new-password', passwordConfirm: 'new-password' },
    });

    await harness.call(users.setPassword, req);

    expect(req.login).toHaveBeenCalled();
  });
});

// Turned on by #1321 (trusted devices)
describe.skip('the password link and the trusted devices', () => {
  it('forgets the trusted devices of the account', async () => {
    harness.addGroup({ requireTwoFactor: true });
    const twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
    const user = harness.addTotpUser();
    const first = await harness.signIn(passport, user);
    const { res } = await harness.call(
      twoFactor.verify,
      harness.makeRequest({
        session: first.req.session,
        body: { code: RFC_CODE, trustDevice: true },
      })
    );
    const cookies = {
      'lp.trusted-device': res.cookies['lp.trusted-device'].value,
    };
    user.token = 'emailed-token';

    await followLink();

    const { answer } = await harness.signIn(passport, user, { cookies });
    expect(answer.body).toEqual({
      twoFactor: { step: 'verify', method: 'totp' },
    });
  });
});
