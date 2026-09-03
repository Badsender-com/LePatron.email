'use strict';

const {
  GUARD_USER,
  GUARD_GROUP_ADMIN,
  GUARD_GROUP_ADMIN_TECH,
  GUARD_GROUP_ADMIN_OR_TECH,
  GUARD_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');

function runGuard(guard, user) {
  return new Promise((resolve) => {
    guard({ user }, {}, (err) => resolve(err));
  });
}

describe('GUARD_USER', () => {
  it('rejects when there is no authenticated user', async () => {
    const err = await runGuard(GUARD_USER, undefined);
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });

  it.each([
    ['regular_user', { isGroupAdmin: false, isGroupAdminTech: false }],
    ['reviewer', { isGroupAdmin: false, isGroupAdminTech: false }],
    ['writer', { isGroupAdmin: false, isGroupAdminTech: false }],
    ['company_admin_tech', { isGroupAdminTech: true }],
    ['company_admin', { isGroupAdmin: true }],
  ])('accepts any authenticated user (%s)', async (_role, user) => {
    const err = await runGuard(GUARD_USER, user);
    expect(err).toBeUndefined();
  });
});

describe('GUARD_GROUP_ADMIN', () => {
  it('accepts a company_admin', async () => {
    const err = await runGuard(GUARD_GROUP_ADMIN, { isGroupAdmin: true });
    expect(err).toBeUndefined();
  });

  it('accepts a super admin', async () => {
    const err = await runGuard(GUARD_GROUP_ADMIN, { isAdmin: true });
    expect(err).toBeUndefined();
  });

  it.each([
    ['company_admin_tech', { isGroupAdminTech: true }],
    ['reviewer', {}],
    ['writer', {}],
    ['regular_user', {}],
  ])('REJECTS a %s', async (_role, user) => {
    const err = await runGuard(GUARD_GROUP_ADMIN, user);
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });
});

describe('GUARD_GROUP_ADMIN_TECH', () => {
  it('accepts a company_admin_tech', async () => {
    const err = await runGuard(GUARD_GROUP_ADMIN_TECH, {
      isGroupAdminTech: true,
    });
    expect(err).toBeUndefined();
  });

  it('accepts a super admin', async () => {
    const err = await runGuard(GUARD_GROUP_ADMIN_TECH, { isAdmin: true });
    expect(err).toBeUndefined();
  });

  it.each([
    ['company_admin', { isGroupAdmin: true }],
    ['reviewer', {}],
    ['writer', {}],
    ['regular_user', {}],
  ])('REJECTS a %s', async (_role, user) => {
    const err = await runGuard(GUARD_GROUP_ADMIN_TECH, user);
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });
});

describe('GUARD_GROUP_ADMIN_OR_TECH', () => {
  it.each([
    ['company_admin', { isGroupAdmin: true }],
    ['company_admin_tech', { isGroupAdminTech: true }],
    ['super_admin', { isAdmin: true }],
  ])('accepts a %s', async (_role, user) => {
    const err = await runGuard(GUARD_GROUP_ADMIN_OR_TECH, user);
    expect(err).toBeUndefined();
  });

  it.each([
    ['reviewer', {}],
    ['writer', {}],
    ['regular_user', {}],
  ])('REJECTS a %s', async (_role, user) => {
    const err = await runGuard(GUARD_GROUP_ADMIN_OR_TECH, user);
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });
});

describe('GUARD_ADMIN', () => {
  it('accepts only a super admin', async () => {
    const err = await runGuard(GUARD_ADMIN, { isAdmin: true });
    expect(err).toBeUndefined();
  });

  it.each([
    ['company_admin', { isGroupAdmin: true }],
    ['company_admin_tech', { isGroupAdminTech: true }],
    ['regular_user', {}],
  ])('REJECTS a %s', async (_role, user) => {
    const err = await runGuard(GUARD_ADMIN, user);
    expect(err).toBeDefined();
    expect(err.status).toBe(401);
  });
});
