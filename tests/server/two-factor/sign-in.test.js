'use strict';

// Signing in when the group requires two-factor authentication (epic #1318,
// ADR 0008). The session opens only once the code is checked: a right
// password alone leaves the account signed out, whatever the answer says.

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
const config = require('../../../packages/server/node.config.js');

const { SecurityEvents } = harness.models;
const { RFC_TIME, RFC_CODE, RFC_NEXT_TIME, RECOVERY_CODES } = harness;

const TEN_MINUTES = 10 * 60 * 1000;

let now;
let twoFactor;

function submitCode(req, body) {
  return harness.call(
    twoFactor.verify,
    harness.makeRequest({ session: req.session, body })
  );
}

beforeEach(() => {
  harness.reset();
  mail.send.mockClear();
  now = RFC_TIME;
  jest.spyOn(Date, 'now').mockImplementation(() => now);
  harness.addGroup({ requireTwoFactor: true });
});

afterEach(() => jest.restoreAllMocks());

describe('the step of the code', () => {
  beforeAll(() => {
    // Required here, not at the top: the module ships with #1320.
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('asks the code after the right password, and opens no session', async () => {
    const user = harness.addTotpUser();

    const { req, answer } = await harness.signIn(passport, user);

    expect(answer.body).toEqual({
      twoFactor: { step: 'verify', method: 'totp' },
    });
    expect(req.logIn).not.toHaveBeenCalled();
  });

  it('opens the session once the code of the authenticator app is checked', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    const { body } = await submitCode(req, { code: RFC_CODE });

    expect(body).toMatchObject({ id: 'u1', email: 'camille@client.test' });
    expect(body.capabilities).toEqual(expect.any(Array));
  });

  it('accepts the code of the previous 30 seconds, for a phone a little behind', async () => {
    const user = harness.addTotpUser();
    now = RFC_NEXT_TIME;
    const { req } = await harness.signIn(passport, user);

    const { body } = await submitCode(req, { code: RFC_CODE });

    expect(body.id).toBe('u1');
  });

  it('refuses a wrong code', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    await expect(submitCode(req, { code: '000000' })).rejects.toMatchObject({
      status: 400,
      message: 'TWO_FACTOR_CODE_INCORRECT',
    });
  });

  it('never accepts the same code twice', async () => {
    const user = harness.addTotpUser();
    const first = await harness.signIn(passport, user);
    await submitCode(first.req, { code: RFC_CODE });

    const second = await harness.signIn(passport, user);

    await expect(
      submitCode(second.req, { code: RFC_CODE })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('sends back to the password after five wrong codes', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);
    for (let i = 0; i < 5; i += 1) {
      await submitCode(req, { code: '000000' }).catch(() => {});
    }

    await expect(submitCode(req, { code: RFC_CODE })).rejects.toMatchObject({
      status: 401,
      message: 'TWO_FACTOR_STEP_EXPIRED',
    });
  });

  it('records five wrong codes in a row as a security event', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);
    for (let i = 0; i < 5; i += 1) {
      await submitCode(req, { code: '000000' }).catch(() => {});
    }

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'two-factor.wrong-codes', user: 'u1' })
    );
  });

  it('ends the step of the code ten minutes after the password', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);
    now += TEN_MINUTES + 1000;

    await expect(submitCode(req, { code: '000000' })).rejects.toMatchObject({
      status: 401,
      message: 'TWO_FACTOR_STEP_EXPIRED',
    });
  });

  it('ends the step when the password changes meanwhile', async () => {
    const user = harness.addTotpUser({ password: 'hash-of-the-old-one' });
    const { req } = await harness.signIn(passport, user);
    user.password = 'hash-of-the-new-one';

    await expect(submitCode(req, { code: RFC_CODE })).rejects.toMatchObject({
      status: 401,
      message: 'TWO_FACTOR_STEP_EXPIRED',
    });
  });

  it('ends the step when an admin resets the setup meanwhile', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);
    user.twoFactorMethod = undefined;
    user.twoFactor = undefined;

    await expect(submitCode(req, { code: RFC_CODE })).rejects.toMatchObject({
      status: 401,
      message: 'TWO_FACTOR_STEP_EXPIRED',
    });
  });

  it('refuses a code sent without the password first', async () => {
    harness.addTotpUser();

    await expect(
      submitCode(harness.makeRequest(), { code: RFC_CODE })
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('who is asked the code', () => {
  it('asks a member of a requiring group without a setup to set it up', async () => {
    const user = harness.addUser();

    const { req, answer } = await harness.signIn(passport, user);

    expect(answer.body).toEqual({ twoFactor: { step: 'setup' } });
    expect(req.logIn).not.toHaveBeenCalled();
  });

  it('signs a member of a group that does not require it straight in, a setup asleep included', async () => {
    harness.addGroup({ requireTwoFactor: false });
    const user = harness.addTotpUser();

    const { req, answer } = await harness.signIn(passport, user);

    expect(req.logIn).toHaveBeenCalled();
    expect(answer.body.id).toBe('u1');
  });

  it('asks a super admin, whatever their group', async () => {
    harness.addGroup({ requireTwoFactor: false });
    const user = harness.addUser({ role: 'super_admin' });

    const { req, answer } = await harness.signIn(passport, user);

    expect(answer.body).toEqual({ twoFactor: { step: 'setup' } });
    expect(req.logIn).not.toHaveBeenCalled();
  });

  it('signs the bootstrap account straight in', async () => {
    const bootstrap = { id: config.admin.id, name: 'admin' };

    const { req } = await harness.signIn(passport, bootstrap);

    expect(req.logIn).toHaveBeenCalled();
  });

  it('signs a member of a SAML group straight in', async () => {
    harness.addGroup({
      requireTwoFactor: true,
      entryPoint: 'https://idp.client.test/sso',
      issuer: 'lepatron',
      idpCert: 'MIIC-certificate',
    });
    const user = harness.addUser();

    const { req } = await harness.signIn(passport, user);

    expect(req.logIn).toHaveBeenCalled();
  });
});

describe('recovery codes', () => {
  beforeAll(() => {
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('opens the session with a recovery code, typed in any case', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    const { body } = await submitCode(req, { code: 'abcd-efgh' });

    expect(body.id).toBe('u1');
  });

  it('gives a new set of ten codes once one is used', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    const { body } = await submitCode(req, { code: RECOVERY_CODES[0] });

    expect(body.recoveryCodes).toHaveLength(10);
    expect(new Set(body.recoveryCodes).size).toBe(10);
    body.recoveryCodes.forEach((code) => {
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(RECOVERY_CODES).not.toContain(code);
    });
  });

  it('refuses a recovery code already used', async () => {
    const user = harness.addTotpUser();
    const first = await harness.signIn(passport, user);
    await submitCode(first.req, { code: RECOVERY_CODES[0] });

    const second = await harness.signIn(passport, user);

    await expect(
      submitCode(second.req, { code: RECOVERY_CODES[0] })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('emails the member and records the event when a recovery code is used', async () => {
    const user = harness.addTotpUser();
    const { req } = await harness.signIn(passport, user);

    await submitCode(req, { code: RECOVERY_CODES[0] });

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'camille@client.test' })
    );
    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.recovery-code-used',
        user: 'u1',
      })
    );
  });
});
