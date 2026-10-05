'use strict';

// Every guard and service branches on `user.isAdmin`, a virtual of the User
// schema that returned `false` for every stored user: the only admin was the
// bootstrap account, outside the database. With super admin as a persisted
// role (ADR 0002) the admin status derives from `role`. Exercised against a
// real Mongoose model, because the enum and the virtuals live in the schema:
// a mocked document would never run them.

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
  it('a company admin administers their group and is not an admin', () => {
    const user = build({ role: 'company_admin' });

    expect(user.isGroupAdmin).toBe(true);
    expect(user.isAdmin).toBe(false);
  });

  it('a regular user is neither a company admin nor an admin', () => {
    const user = build({ role: 'regular_user' });

    expect(user.isGroupAdmin).toBe(false);
    expect(user.isAdmin).toBe(false);
  });

  it('a user without a role is neither a company admin nor an admin', () => {
    const user = build({});

    expect(user.isGroupAdmin).toBe(false);
    expect(user.isAdmin).toBe(false);
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

    it('a super admin is an admin', () => {
      expect(build({ role: 'super_admin' }).isAdmin).toBe(true);
    });

    it('a super admin is not a company admin', () => {
      expect(build({ role: 'super_admin' }).isGroupAdmin).toBe(false);
    });

    it('serialises its admin status for the session and the UI', () => {
      const json = build({ role: 'super_admin' }).toJSON();

      expect(json.role).toBe('super_admin');
      expect(json.isAdmin).toBe(true);
      expect(json.isGroupAdmin).toBe(false);
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
      expect(user.isAdmin).toBe(true);
    });
  });
});
