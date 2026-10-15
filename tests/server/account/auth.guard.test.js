'use strict';

// Route protection is one word per route, and nothing else notices which
// account a guard lets through. `GUARD_ADMIN` had no test of its own: the only
// admin was the bootstrap account, a frozen object outside the database.
// Super admin becoming a persisted role (ADR 0002) makes a stored user pass
// it, so the guards are specified here against real `User` documents,
// serialised the way passport puts them on a request.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: {},
  Groups: {},
  OAuthClients: {},
  OAuthTokens: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const UserSchema = require('../../../packages/server/user/user.schema.js');
const {
  adminUser,
  GUARD_USER,
  GUARD_USER_REDIRECT,
  GUARD_GROUP_ADMIN,
  GUARD_ADMIN,
  GUARD_ADMIN_REDIRECT,
} = require('../../../packages/server/account/auth.guard.js');

// A model name of its own, so registering it cannot collide with the app's.
const User = mongoose.model('UserSchemaGuardTest', UserSchema);
const PLATFORM_GROUP = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');

// passport.deserializeUser hands `user.toJSON()` to the request.
function persisted(role) {
  return new User({
    email: `${role}@platform.test`,
    _company: PLATFORM_GROUP,
    role,
  }).toJSON();
}

function runGuard(guard, user) {
  return new Promise((resolve) => {
    const res = { redirect: (url) => resolve({ redirectedTo: url }) };
    guard({ user }, res, (err) => resolve({ err }));
  });
}

const PASSES = { err: undefined };

async function expectRejected(guard, user) {
  const { err } = await runGuard(guard, user);
  expect(err).toBeDefined();
  expect(err.status).toBe(401);
}

describe('auth guards', () => {
  describe('without a session', () => {
    it('rejects the user guard', () => expectRejected(GUARD_USER, undefined));

    it('rejects the group admin guard', () =>
      expectRejected(GUARD_GROUP_ADMIN, undefined));

    it('rejects the admin guard', () => expectRejected(GUARD_ADMIN, undefined));

    it('sends pages outside Nuxt to the login page instead of a 401', async () => {
      expect(await runGuard(GUARD_USER_REDIRECT, undefined)).toEqual({
        redirectedTo: '/account/login',
      });
      expect(await runGuard(GUARD_ADMIN_REDIRECT, undefined)).toEqual({
        redirectedTo: '/account/login',
      });
    });
  });

  describe('the bootstrap account', () => {
    it('passes the user guard', async () => {
      expect(await runGuard(GUARD_USER, { ...adminUser })).toEqual(PASSES);
    });

    it('passes the group admin guard', async () => {
      expect(await runGuard(GUARD_GROUP_ADMIN, { ...adminUser })).toEqual(
        PASSES
      );
    });

    it('passes the admin guard', async () => {
      expect(await runGuard(GUARD_ADMIN, { ...adminUser })).toEqual(PASSES);
    });
  });

  describe('a persisted company admin', () => {
    const companyAdmin = persisted('company_admin');

    it('passes the user guard', async () => {
      expect(await runGuard(GUARD_USER, companyAdmin)).toEqual(PASSES);
    });

    it('passes the group admin guard', async () => {
      expect(await runGuard(GUARD_GROUP_ADMIN, companyAdmin)).toEqual(PASSES);
    });

    it('is rejected by the admin guard', () =>
      expectRejected(GUARD_ADMIN, companyAdmin));

    it('is sent to the login page by the admin redirect guard', async () => {
      expect(await runGuard(GUARD_ADMIN_REDIRECT, companyAdmin)).toEqual({
        redirectedTo: '/account/login',
      });
    });
  });

  describe('a persisted regular user', () => {
    const regularUser = persisted('regular_user');

    it('passes the user guard', async () => {
      expect(await runGuard(GUARD_USER, regularUser)).toEqual(PASSES);
    });

    it('is rejected by the group admin guard', () =>
      expectRejected(GUARD_GROUP_ADMIN, regularUser));

    it('is rejected by the admin guard', () =>
      expectRejected(GUARD_ADMIN, regularUser));
  });

  // Turned on by #1155 (super admin as a persisted role: admin status,
  // guardrails and listing).
  describe('a persisted super admin (#1155)', () => {
    const superAdmin = persisted('super_admin');

    it('passes the user guard', async () => {
      expect(await runGuard(GUARD_USER, superAdmin)).toEqual(PASSES);
    });

    it('passes the group admin guard', async () => {
      expect(await runGuard(GUARD_GROUP_ADMIN, superAdmin)).toEqual(PASSES);
    });

    it('passes the admin guard, like the bootstrap account', async () => {
      expect(await runGuard(GUARD_ADMIN, superAdmin)).toEqual(PASSES);
    });

    it('passes the admin redirect guard of the pages outside Nuxt', async () => {
      expect(await runGuard(GUARD_ADMIN_REDIRECT, superAdmin)).toEqual(PASSES);
    });
  });
});

describe('the roles added by the roles and permissions epic', () => {
  const {
    GUARD_GROUP_ADMIN_TECH,
  } = require('../../../packages/server/account/auth.guard.js');

  const companyAdmin = persisted('company_admin');
  const tech = persisted('company_admin_tech');
  const reviewer = persisted('reviewer');
  const writer = persisted('writer');
  const regular = persisted('regular_user');
  const superAdmin = persisted('super_admin');

  it.each([
    ['company_admin_tech', tech],
    ['reviewer', reviewer],
    ['writer', writer],
  ])('a %s passes the user guard', async (_role, user) => {
    expect(await runGuard(GUARD_USER, user)).toEqual(PASSES);
  });

  it('a company_admin_tech passes the group admin guard: a tech admin is a company admin too', async () => {
    expect(await runGuard(GUARD_GROUP_ADMIN, tech)).toEqual(PASSES);
  });

  it.each([
    ['reviewer', reviewer],
    ['writer', writer],
  ])('a %s is rejected by the group admin guard', (_role, user) =>
    expectRejected(GUARD_GROUP_ADMIN, user)
  );

  describe('GUARD_GROUP_ADMIN_TECH', () => {
    it.each([
      ['company_admin_tech', tech],
      ['super_admin', superAdmin],
    ])('accepts a %s', async (_role, user) => {
      expect(await runGuard(GUARD_GROUP_ADMIN_TECH, user)).toEqual(PASSES);
    });

    it.each([
      ['company_admin', companyAdmin],
      ['reviewer', reviewer],
      ['writer', writer],
      ['regular_user', regular],
    ])('rejects a %s', (_role, user) =>
      expectRejected(GUARD_GROUP_ADMIN_TECH, user)
    );
  });

  it.each([
    ['company_admin_tech', tech],
    ['reviewer', reviewer],
    ['writer', writer],
  ])('a %s is rejected by the admin guard', (_role, user) =>
    expectRejected(GUARD_ADMIN, user)
  );
});

describe('GUARD_CAN: the route needs a capability', () => {
  const {
    GUARD_CAN,
  } = require('../../../packages/server/account/auth.guard.js');
  const { CAPABILITIES } = require('../../../packages/shared/access/roles.js');

  const guard = GUARD_CAN(CAPABILITIES.MAILING_DELETE);

  it('lets a role that has it through', async () => {
    expect(await runGuard(guard, persisted('regular_user'))).toEqual(PASSES);
  });

  it('refuses a role that lacks it, with its own code', async () => {
    const { err } = await runGuard(guard, persisted('writer'));

    expect(err.status).toBe(403);
    expect(err.message).toBe('FORBIDDEN_CAPABILITY');
  });

  it('asks for a session first', async () => {
    const { err } = await runGuard(guard, undefined);

    expect(err.status).toBe(401);
  });

  it.each([
    ['the bootstrap account', { ...adminUser }],
    ['a super admin', persisted('super_admin')],
  ])('lets %s through', async (_label, user) => {
    expect(await runGuard(guard, user)).toEqual(PASSES);
  });

  it('treats an account stored before the roles as a regular user', async () => {
    const legacy = new User({
      email: 'legacy@platform.test',
      _company: PLATFORM_GROUP,
    }).toJSON();

    expect(await runGuard(guard, legacy)).toEqual(PASSES);
    expect(
      (await runGuard(GUARD_CAN(CAPABILITIES.GROUP_MANAGE), legacy)).err.status
    ).toBe(403);
  });

  it('refuses an unknown role everything', async () => {
    const { err } = await runGuard(GUARD_CAN(CAPABILITIES.MAILING_COMMENT), {
      role: 'owner',
    });

    expect(err.status).toBe(403);
  });

  it('is one middleware per capability, so routes compare by identity', () => {
    expect(GUARD_CAN(CAPABILITIES.MAILING_DELETE)).toBe(guard);
  });

  it('throws on a misspelt capability when the routes load', () => {
    expect(() => GUARD_CAN('mailing.remove')).toThrow(
      'Unknown capability: mailing.remove'
    );
  });
});
