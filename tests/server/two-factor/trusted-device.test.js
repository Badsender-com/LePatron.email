'use strict';

// Trusted devices (epic #1318, ADR 0008): a browser the member chose to
// remember skips the code for thirty days, never the password, unless the
// sign-in is suspicious.

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
const mail = require('../../../packages/server/mailing/mail.service.js');

const { SecurityEvents } = harness.models;
const { RFC_TIME, RFC_CODE } = harness;

const COOKIE = 'lp.trusted-device';
const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
const VERIFY_TOTP = { twoFactor: { step: 'verify', method: 'totp' } };

let now;
let twoFactor;

// Signs in with the code and ticks "trust this device"; gives the cookie.
async function trustThisBrowser(user) {
  const { req } = await harness.signIn(passport, user);
  const { res } = await harness.call(
    twoFactor.verify,
    harness.makeRequest({
      session: req.session,
      body: { code: RFC_CODE, trustDevice: true },
    })
  );
  return res.cookies[COOKIE];
}

beforeEach(() => {
  harness.reset();
  mail.send.mockClear();
  now = RFC_TIME;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  harness.addGroup({ requireTwoFactor: true });
});

afterEach(() => jest.restoreAllMocks());

// Turned on by #1321 (trusted devices)
describe.skip('trusting a device', () => {
  beforeAll(() => {
    // Required here, not at the top: the module ships with #1320.
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('gives an httpOnly cookie of its own, for thirty days', async () => {
    const cookie = await trustThisBrowser(harness.addTotpUser());

    expect(cookie.value).toMatch(/^[0-9a-f]{64}$/);
    expect(cookie.options).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      maxAge: THIRTY_DAYS,
    });
  });

  it('sets no cookie unless the member asks', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    const { res } = await harness.call(
      twoFactor.verify,
      harness.makeRequest({ session: req.session, body: { code: RFC_CODE } })
    );

    expect(res.cookies[COOKIE]).toBeUndefined();
  });

  it('keeps only a hash of the cookie in the database', async () => {
    const user = harness.addTotpUser();

    const cookie = await trustThisBrowser(user);

    expect(JSON.stringify(user.twoFactor)).not.toContain(cookie.value);
  });

  it('emails the member and records the event', async () => {
    await trustThisBrowser(harness.addTotpUser());

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'camille@client.test' })
    );
    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.device-trusted',
        user: 'u1',
      })
    );
  });
});

// Turned on by #1321 (trusted devices)
describe.skip('signing in from a trusted device', () => {
  beforeAll(() => {
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  async function signInAgain(user, cookie, userAgent) {
    return harness.signIn(passport, user, {
      cookies: { [COOKIE]: cookie.value },
      userAgent,
    });
  }

  it('asks the password only', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);

    const { req, answer } = await signInAgain(user, cookie);

    expect(req.logIn).toHaveBeenCalled();
    expect(answer.body.id).toBe('u1');
  });

  it('still trusts the browser once it updates itself', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);

    const { req } = await signInAgain(
      user,
      cookie,
      harness.NEWER_CHROME_ON_MAC
    );

    expect(req.logIn).toHaveBeenCalled();
  });

  it('asks the code from another browser', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);

    const { answer } = await signInAgain(user, cookie, harness.FIREFOX_ON_MAC);

    expect(answer.body).toEqual(VERIFY_TOTP);
  });

  it('asks the code from another OS', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);

    const { answer } = await signInAgain(
      user,
      cookie,
      harness.CHROME_ON_WINDOWS
    );

    expect(answer.body).toEqual(VERIFY_TOTP);
  });

  it('asks the code once the thirty days are over', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);
    now += THIRTY_DAYS + 1000;

    const { answer } = await signInAgain(user, cookie);

    expect(answer.body).toEqual(VERIFY_TOTP);
  });

  it('asks the code after five wrong passwords on the account', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);
    user.twoFactor.failedPasswords = 5;

    const { answer } = await signInAgain(user, cookie);

    expect(answer.body).toEqual(VERIFY_TOTP);
  });

  it('trusts the device again once the member signs in with the code', async () => {
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);
    user.twoFactor.failedPasswords = 5;
    const { req } = await signInAgain(user, cookie);
    await harness
      .call(
        twoFactor.verify,
        harness.makeRequest({ session: req.session, body: { code: RFC_CODE } })
      )
      .catch(() => {});
    now += 30 * 1000;

    const again = await signInAgain(user, cookie);

    expect(again.req.logIn).toHaveBeenCalled();
  });

  it('trusts nothing for another account', async () => {
    const cookie = await trustThisBrowser(harness.addTotpUser());
    const other = harness.addTotpUser({
      _id: 'u2',
      id: 'u2',
      email: 'dominique@client.test',
    });

    const { answer } = await signInAgain(other, cookie);

    expect(answer.body).toEqual(VERIFY_TOTP);
  });

  it('forgets the devices of an account an admin deactivates', async () => {
    const users = require('../../../packages/server/user/user.controller.js');
    const user = harness.addTotpUser();
    const cookie = await trustThisBrowser(user);
    const admin = {
      id: 'a1',
      role: 'company_admin',
      group: { id: harness.GROUP_ID },
    };
    const asAdmin = () =>
      harness.makeRequest({ user: admin, params: { userId: 'u1' } });
    await harness.call(users.deactivate, asAdmin());
    await harness.call(users.activate, asAdmin());

    const { answer } = await signInAgain(user, cookie);

    expect(answer.body).toEqual(VERIFY_TOTP);
  });
});
