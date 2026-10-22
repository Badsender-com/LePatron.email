'use strict';

// A two-factor reset by an admin (epic #1318, ADR 0008): the only way past a
// member's two-factor authentication, so it follows the rule of ADR 0004
// (nobody resets an account whose capabilities are not all their own), ends
// the member's sessions and tells them.

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
const { GROUP_ID, OTHER_GROUP_ID } = harness;

const companyAdmin = {
  id: 'a1',
  name: 'Alex Admin',
  email: 'alex@client.test',
  role: 'company_admin',
  group: { id: GROUP_ID },
};
const techAdmin = { ...companyAdmin, id: 'a2', role: 'company_admin_tech' };
const superAdmin = {
  id: 'a3',
  name: 'Sam Platform',
  email: 'sam@platform.test',
  role: 'super_admin',
  group: { id: OTHER_GROUP_ID },
};
const otherGroupAdmin = { ...companyAdmin, id: 'a4', group: OTHER_GROUP_ID };

let twoFactor;

function resetAs(actor, userId = 'u1') {
  return harness.call(
    twoFactor.adminReset,
    harness.makeRequest({ user: actor, params: { userId } })
  );
}

beforeEach(() => {
  harness.reset();
  mail.send.mockClear();
  harness.addGroup({ requireTwoFactor: true });
});

describe('resetting a member’s two-factor authentication', () => {
  beforeAll(() => {
    // Required here, not at the top: the module ships with #1320.
    twoFactor = require('../../../packages/server/two-factor/two-factor.controller.js');
  });

  it('lets a company admin reset a member of their group, who sets it up again', async () => {
    const user = harness.addTotpUser();

    await resetAs(companyAdmin);

    const { answer } = await harness.signIn(passport, user);
    expect(answer.body).toEqual({ twoFactor: { step: 'setup' } });
  });

  it('answers the member as the users table reads it, without a method', async () => {
    harness.addTotpUser();

    const { body } = await resetAs(companyAdmin);

    expect(body.id).toBe('u1');
    expect(body.twoFactorMethod).toBeUndefined();
  });

  it('ends the member’s sessions', async () => {
    const user = harness.addTotpUser();

    await resetAs(companyAdmin);

    expect(user.activeSessionId).not.toBe('previous-session');
  });

  it('emails the member, without saying who reset it', async () => {
    harness.addTotpUser();

    await resetAs(companyAdmin);

    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'camille@client.test' })
    );
    const sent = JSON.stringify(mail.send.mock.calls);
    expect(sent).not.toContain('Alex Admin');
    expect(sent).not.toContain('alex@client.test');
  });

  it('records the reset, with who did it', async () => {
    harness.addTotpUser();

    await resetAs(companyAdmin);

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.reset',
        actor: 'a1',
        user: 'u1',
      })
    );
  });

  it('refuses a company admin resetting a tech admin', async () => {
    harness.addTotpUser({ role: 'company_admin_tech' });

    await expect(resetAs(companyAdmin)).rejects.toMatchObject({ status: 403 });
  });

  it('lets a tech admin reset a tech admin of their group', async () => {
    harness.addTotpUser({ role: 'company_admin_tech' });

    const { body } = await resetAs(techAdmin);

    expect(body.id).toBe('u1');
  });

  it('refuses a company admin resetting a super admin', async () => {
    harness.addTotpUser({ role: 'super_admin' });

    await expect(resetAs(companyAdmin)).rejects.toMatchObject({ status: 403 });
  });

  it('lets a super admin reset a member of any group', async () => {
    harness.addTotpUser();

    const { body } = await resetAs(superAdmin);

    expect(body.id).toBe('u1');
  });

  it('refuses an admin of another group', async () => {
    harness.addTotpUser();

    await expect(resetAs(otherGroupAdmin)).rejects.toMatchObject({
      status: 403,
    });
  });

  it('answers 404 for an unknown account', async () => {
    await expect(resetAs(companyAdmin, 'nobody')).rejects.toMatchObject({
      status: 404,
    });
  });
});
