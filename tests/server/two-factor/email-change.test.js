'use strict';

// Changing the address of a member who set up two-factor authentication
// (epic #1318, ADR 0008): an emailed code goes to that address, so the change
// is a tech admin's or a super admin's, and for an emailed method it resets
// the setup and tells the previous address.

const harness = require('../../helpers/two-factor-harness.js');

jest.mock('passport', () => ({
  authenticate: jest.fn(),
  use: jest.fn(),
  serializeUser: jest.fn(),
  deserializeUser: jest.fn(),
}));
jest.mock(
  '../../../packages/server/common/models.common.js',
  () => require('../../helpers/two-factor-harness.js').models
);
jest.mock('../../../packages/server/mailing/mail.service.js', () => ({
  send: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../packages/server/user/user.service.js', () => ({
  updateUser: jest.fn(),
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

const mail = require('../../../packages/server/mailing/mail.service.js');
const userService = require('../../../packages/server/user/user.service.js');
const {
  ROLES,
  CAPABILITIES,
  roleCan,
} = require('../../../packages/shared/access/roles.js');
const {
  emailChangeResets,
} = require('../../../packages/server/two-factor/reset.js');
const { adminUser } = require('../../../packages/server/account/auth.guard.js');

const { SecurityEvents } = harness.models;
const { GROUP_ID } = harness;

const companyAdmin = {
  id: 'a1',
  name: 'Alex Admin',
  email: 'alex@client.test',
  role: 'company_admin',
  group: { id: GROUP_ID },
};
const techAdmin = { ...companyAdmin, id: 'a2', role: 'company_admin_tech' };

const NEW_ADDRESS = 'someone.else@client.test';

let users;

function updateAs(actor, body) {
  return harness.call(
    users.update,
    harness.makeRequest({ user: actor, params: { userId: 'u1' }, body })
  );
}

function addEmailUser(overrides) {
  return harness.addUser({
    twoFactorMethod: 'email',
    twoFactor: { recoveryCodes: [], trustedDevices: [], failedPasswords: 0 },
    ...overrides,
  });
}

beforeAll(() => {
  users = require('../../../packages/server/user/user.controller.js');
});

beforeEach(() => {
  harness.reset();
  mail.send.mockClear();
  harness.addGroup({ requireTwoFactor: true });
  // As the service: the fields written onto the stored account, a fresh
  // copy answered.
  userService.updateUser.mockReset();
  userService.updateUser.mockImplementation(async ({ userId, ...fields }) => {
    const stored = await harness.models.Users.findOneForApi({ _id: userId });
    return { ...stored, ...fields };
  });
});

describe('who may change the address of an account that has set up two-factor authentication', () => {
  const target = { twoFactorMethod: 'email', email: 'camille@client.test' };
  const change = { email: NEW_ADDRESS };

  it.each(Object.values(ROLES))('%s', (role) => {
    const attempt = () => emailChangeResets({ role }, target, change);

    if (roleCan(role, CAPABILITIES.GROUP_MANAGE_TECH)) {
      expect(attempt()).toBe(true);
    } else {
      expect(attempt).toThrow(expect.objectContaining({ status: 403 }));
    }
  });

  it('the bootstrap account', () => {
    expect(emailChangeResets(adminUser, target, change)).toBe(true);
  });
});

describe('a tech admin changing the address of a member', () => {
  it('resets an emailed method: setup erased, sessions ended', async () => {
    const user = addEmailUser();

    const { body } = await updateAs(techAdmin, { email: NEW_ADDRESS });

    expect(harness.models.Users.updateOne).toHaveBeenCalledWith(
      { _id: 'u1' },
      { $unset: { twoFactor: 1, twoFactorMethod: 1 } }
    );
    expect(user.activeSessionId).not.toBe('previous-session');
    expect(body.twoFactorMethod).toBeUndefined();
  });

  it('records the reset, with who did it', async () => {
    addEmailUser();

    await updateAs(techAdmin, { email: NEW_ADDRESS });

    expect(SecurityEvents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'two-factor.reset',
        actor: 'a2',
        user: 'u1',
      })
    );
  });

  it('tells the previous address, without saying who', async () => {
    addEmailUser();

    await updateAs(techAdmin, { email: NEW_ADDRESS });

    expect(mail.send).toHaveBeenCalledTimes(1);
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'camille@client.test' })
    );
    const sent = JSON.stringify(mail.send.mock.calls);
    expect(sent).toContain('L’adresse de votre compte a changé');
    expect(sent).not.toContain('Alex Admin');
  });

  it('keeps an authenticator app: the code does not go to the address', async () => {
    harness.addTotpUser();

    const { body } = await updateAs(techAdmin, { email: NEW_ADDRESS });

    expect(body.twoFactorMethod).toBe('totp');
    expect(harness.models.Users.updateOne).not.toHaveBeenCalled();
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('resets nothing when the address is refused by the write', async () => {
    addEmailUser();
    userService.updateUser.mockRejectedValue(new Error('E11000'));

    await expect(updateAs(techAdmin, { email: NEW_ADDRESS })).rejects.toThrow(
      'E11000'
    );
    expect(harness.models.Users.updateOne).not.toHaveBeenCalled();
    expect(SecurityEvents.create).not.toHaveBeenCalled();
  });
});

describe('a company admin', () => {
  it('cannot change the address of a member who set it up', async () => {
    addEmailUser();

    await expect(
      updateAs(companyAdmin, { email: NEW_ADDRESS })
    ).rejects.toMatchObject({ status: 403 });
    expect(userService.updateUser).not.toHaveBeenCalled();
  });

  it('cannot change it for an authenticator app either', async () => {
    harness.addTotpUser();

    await expect(
      updateAs(companyAdmin, { email: NEW_ADDRESS })
    ).rejects.toMatchObject({ status: 403 });
  });

  it('changes the address of a member who has not set it up', async () => {
    harness.addUser();

    const { body } = await updateAs(companyAdmin, { email: NEW_ADDRESS });

    expect(body.email).toBe(NEW_ADDRESS);
  });

  it('saves the rest of the form, the address unchanged', async () => {
    addEmailUser();

    const { body } = await updateAs(companyAdmin, {
      email: ' Camille@Client.test ',
      name: 'Camille Durand',
    });

    expect(body.name).toBe('Camille Durand');
    expect(body.twoFactorMethod).toBe('email');
    expect(harness.models.Users.updateOne).not.toHaveBeenCalled();
  });
});
