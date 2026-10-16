'use strict';

// The User schema: the roles it accepts, and what a user's JSON carries. What
// a role may do is read from `role` by account/permissions.js, never from a
// flag of the document. Exercised against a real Mongoose model, because the
// enum and the virtuals live in the schema: a mocked document would never run
// them.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const mongoose = require('mongoose');

const UserSchema = require('../../../packages/server/user/user.schema.js');

const PLATFORM_GROUP = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');

let User;

beforeAll(() => {
  // A model name of its own, so registering it cannot collide with the app's.
  User = mongoose.model('UserSchemaTest', UserSchema);
});

const build = (overrides) =>
  new User({
    email: 'someone@platform.test',
    _company: PLATFORM_GROUP,
    ...overrides,
  });

describe('User roles', () => {
  // Rights are read from the role (account/permissions.js): the document
  // carries no admin flag a client or a check could read instead.
  it.each([
    'super_admin',
    'company_admin_tech',
    'company_admin',
    'regular_user',
    'writer',
    'reviewer',
  ])('serialises a %s with its role and no admin flag', (role) => {
    const json = build({ role }).toJSON();

    expect(json.role).toBe(role);
    expect(json).not.toHaveProperty('isAdmin');
    expect(json).not.toHaveProperty('isGroupAdmin');
    expect(json).not.toHaveProperty('isGroupAdminTech');
  });

  it('refuses a role the product does not define', () => {
    const errors = build({ role: 'owner' }).validateSync();

    expect(errors.errors.role).toBeDefined();
  });

  // Turned on by #1155 (super admin as a persisted role: admin status,
  // guardrails and listing).
  describe('super admin as a persisted role (#1155)', () => {
    it('accepts the super_admin role', () => {
      const errors = build({ role: 'super_admin' }).validateSync();

      expect(errors).toBeUndefined();
    });

    it('is an ordinary account otherwise: invited, then confirmed', () => {
      expect(build({ role: 'super_admin' }).status).toBe('to-be-initialized');
      expect(build({ role: 'super_admin', token: 'invite' }).status).toBe(
        'password-mail-sent'
      );
      expect(build({ role: 'super_admin', password: 's3cret' }).status).toBe(
        'confirmed'
      );
    });

    it('is deactivated like any user', () => {
      const user = build({ role: 'super_admin', isDeactivated: true });

      expect(user.status).toBe('deactivated');
      expect(user.role).toBe('super_admin');
    });
  });
});
