'use strict';

// Setting up two-factor authentication at the sign-in that follows the group
// requiring it (epic #1318, ADR 0008): nothing is kept until a first code
// proves the member's authenticator app gives the right ones.

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

const { SecurityEvents } = harness.models;

let twoFactor;
// What the member's authenticator app shows for a secret, now.
let codeOf;

const step = (handler, req, body) =>
  harness.call(handler, harness.makeRequest({ session: req.session, body }));

beforeEach(() => {
  harness.reset();
  harness.addGroup({ requireTwoFactor: true });
});

// Turned on by #1320 (two-factor authentication with an authenticator app)
describe.skip('setting up the authenticator app', () => {
  beforeAll(() => {
    // Required here, not at the top: these modules ship with #1320.
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
    const { generateSync } = require('otplib');
    codeOf = (secret) => generateSync({ secret });
  });

  it('gives a secret, its otpauth link and its QR code', async () => {
    const { req } = await harness.signIn(passport, harness.addUser());

    const { body } = await step(twoFactor.startSetup, req, { method: 'totp' });

    expect(body.method).toBe('totp');
    expect(body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(body.uri).toMatch(/^otpauth:\/\/totp\//);
    expect(body.uri).toContain(`secret=${body.secret}`);
    expect(body.uri).toContain(encodeURIComponent('camille@client.test'));
    expect(body.qrCode).toMatch(/^data:image\/png;base64,/);
  });

  it('opens the session once the first code is confirmed, with ten recovery codes', async () => {
    const { req } = await harness.signIn(passport, harness.addUser());
    const { body: setup } = await step(twoFactor.startSetup, req, {
      method: 'totp',
    });

    const { body } = await step(twoFactor.confirmSetup, req, {
      code: codeOf(setup.secret),
    });

    expect(body.id).toBe('u1');
    expect(body.recoveryCodes).toHaveLength(10);
    expect(new Set(body.recoveryCodes).size).toBe(10);
  });

  it('asks the code, not a new setup, at the next sign-in', async () => {
    const user = harness.addUser();
    const first = await harness.signIn(passport, user);
    const { body: setup } = await step(twoFactor.startSetup, first.req, {
      method: 'totp',
    });
    await step(twoFactor.confirmSetup, first.req, {
      code: codeOf(setup.secret),
    });

    const { answer } = await harness.signIn(passport, user);

    expect(answer.body).toEqual({
      twoFactor: { step: 'verify', method: 'totp' },
    });
  });

  it('keeps nothing when the first code is wrong', async () => {
    const user = harness.addUser();
    const first = await harness.signIn(passport, user);
    await step(twoFactor.startSetup, first.req, { method: 'totp' });

    await expect(
      step(twoFactor.confirmSetup, first.req, { code: '000000' })
    ).rejects.toMatchObject({ status: 400 });
    const { answer } = await harness.signIn(passport, user);
    expect(answer.body).toEqual({ twoFactor: { step: 'setup' } });
  });

  it('never stores the secret as it was shown', async () => {
    const user = harness.addUser();
    const { req } = await harness.signIn(passport, user);
    const { body: setup } = await step(twoFactor.startSetup, req, {
      method: 'totp',
    });
    await step(twoFactor.confirmSetup, req, { code: codeOf(setup.secret) });

    expect(JSON.stringify(user.twoFactor)).not.toContain(setup.secret);
  });

  it('records the setup and its method', async () => {
    const { req } = await harness.signIn(passport, harness.addUser());
    const { body: setup } = await step(twoFactor.startSetup, req, {
      method: 'totp',
    });
    await step(twoFactor.confirmSetup, req, { code: codeOf(setup.secret) });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.set-up',
        user: 'u1',
        method: 'totp',
      })
    );
  });

  it('refuses a method the product does not offer', async () => {
    const { req } = await harness.signIn(passport, harness.addUser());

    await expect(
      step(twoFactor.startSetup, req, { method: 'sms' })
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a setup without the password first', async () => {
    harness.addUser();

    await expect(
      harness.call(
        twoFactor.startSetup,
        harness.makeRequest({ body: { method: 'totp' } })
      )
    ).rejects.toMatchObject({ status: 401 });
  });

  it('never lets the password alone replace a setup', async () => {
    const { req } = await harness.signIn(passport, harness.addTotpUser());

    await expect(
      step(twoFactor.startSetup, req, { method: 'totp' })
    ).rejects.toMatchObject({ status: 409 });
  });
});
