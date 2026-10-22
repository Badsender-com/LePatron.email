'use strict';

// The code by email (epic #1318, ADR 0008): the second verification method,
// chosen at setup. A six-digit code sent to the account's address, valid ten
// minutes and once, with a bounded number of sends.

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

const EMAIL = 'camille@client.test';
const VERIFY_EMAIL = { twoFactor: { step: 'verify', method: 'email' } };

let twoFactor;
// Each test starts two hours after the previous one, so the hourly budget of
// an account starts afresh.
let now = Date.UTC(2026, 9, 22);

const step = (handler, req, body = {}) =>
  harness.call(handler, harness.makeRequest({ session: req.session, body }));
const emailedCode = () => harness.lastEmailedCode(mail, EMAIL);
const emailsSent = () =>
  mail.send.mock.calls.filter(([message]) => message.to === EMAIL).length;

// An account that set up the code by email.
const addEmailUser = () =>
  harness.addUser({
    twoFactorMethod: 'email',
    twoFactor: { recoveryCodes: [], trustedDevices: [], failedPasswords: 0 },
  });

beforeEach(() => {
  harness.reset();
  mail.send.mockClear();
  now += 2 * 60 * 60 * 1000;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  harness.addGroup({ requireTwoFactor: true });
});

afterEach(() => jest.restoreAllMocks());

// Turned on by #1322 (verification code by email)
describe.skip('setting up the code by email', () => {
  beforeAll(() => {
    // Required here, not at the top: the module ships with #1320.
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('sends a six-digit code to the account’s address', async () => {
    const { req } = await harness.signIn(passport, harness.addUser());

    const { body } = await step(twoFactor.startSetup, req, {
      method: 'email',
    });

    expect(body).toEqual({ method: 'email' });
    expect(emailedCode()).toMatch(/^\d{6}$/);
  });

  it('opens the session once the emailed code is confirmed, then asks it at each sign-in', async () => {
    const user = harness.addUser();
    const first = await harness.signIn(passport, user);
    await step(twoFactor.startSetup, first.req, { method: 'email' });

    const { body } = await step(twoFactor.confirmSetup, first.req, {
      code: emailedCode(),
    });

    expect(body.id).toBe('u1');
    expect(body.recoveryCodes).toHaveLength(10);
    const { answer } = await harness.signIn(passport, user);
    expect(answer.body).toEqual(VERIFY_EMAIL);
  });
});

// Turned on by #1322 (verification code by email)
describe.skip('signing in with the code by email', () => {
  beforeAll(() => {
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('sends a code once the password is right', async () => {
    await harness.signIn(passport, addEmailUser());

    expect(emailedCode()).toMatch(/^\d{6}$/);
  });

  it('opens the session with the emailed code', async () => {
    const { req } = await harness.signIn(passport, addEmailUser());

    const { body } = await step(twoFactor.verify, req, {
      code: emailedCode(),
    });

    expect(body.id).toBe('u1');
  });

  it('refuses the previous code once a new one is sent', async () => {
    const { req } = await harness.signIn(passport, addEmailUser());
    const previous = emailedCode();
    await step(twoFactor.sendEmailCode, req);

    const current = emailedCode();

    // Two codes drawn at random may be equal, one time in a million.
    if (current !== previous) {
      await expect(
        step(twoFactor.verify, req, { code: previous })
      ).rejects.toMatchObject({ status: 400 });
    }
    const { body } = await step(twoFactor.verify, req, { code: current });
    expect(body.id).toBe('u1');
  });

  it('sends at most three codes per sign-in', async () => {
    const { req } = await harness.signIn(passport, addEmailUser());
    await step(twoFactor.sendEmailCode, req);
    await step(twoFactor.sendEmailCode, req);

    await expect(step(twoFactor.sendEmailCode, req)).rejects.toMatchObject({
      status: 429,
    });
    expect(emailsSent()).toBe(3);
  });

  it('sends at most ten codes an hour on an account', async () => {
    const user = addEmailUser();
    const refused = [];
    for (let i = 0; i < 4; i += 1) {
      const { req } = await harness.signIn(passport, user);
      for (let j = 0; j < 2; j += 1) {
        await step(twoFactor.sendEmailCode, req).catch((error) =>
          refused.push(error.status)
        );
      }
    }

    expect(emailsSent()).toBe(10);
    expect(refused).toContain(429);
  });

  it('never sends a code for an account using the authenticator app', async () => {
    const { req } = await harness.signIn(passport, harness.addTotpUser());

    await expect(step(twoFactor.sendEmailCode, req)).rejects.toMatchObject({
      status: 400,
    });
    expect(emailsSent()).toBe(0);
  });
});
