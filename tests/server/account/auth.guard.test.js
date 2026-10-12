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
