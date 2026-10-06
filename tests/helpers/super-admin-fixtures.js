'use strict';

/**
 * Shared fixtures of the super admin acceptance tests (epic #1153): a
 * platform group and a client group, two super admins, a company admin and a
 * regular user in each group, the bootstrap account, and a `call` helper that
 * runs a controller handler the way express would and resolves with what the
 * client sees.
 */

const config = require('../../packages/server/node.config.js');

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';

const ALICE = '507f1f77bcf86cd799439101'; // super admin
const BOB = '507f1f77bcf86cd799439102'; // super admin
const CAROL = '507f1f77bcf86cd799439103'; // company admin of the platform group
const DAVE = '507f1f77bcf86cd799439104'; // regular user of the platform group
const ERIN = '507f1f77bcf86cd799439105'; // company admin of a client group
const FRANK = '507f1f77bcf86cd799439106'; // regular user of a client group

const GROUPS = [
  { _id: PLATFORM_GROUP, name: 'Platform', isPlatform: true },
  { _id: CLIENT_GROUP, name: 'A client' },
];

function user(_id, name, role, _company, extra = {}) {
  return {
    _id,
    name,
    role,
    _company,
    email: `${name.toLowerCase()}@example.test`,
    lang: 'fr',
    password: 'hashed',
    ...extra,
  };
}

const USERS = [
  user(ALICE, 'Alice', 'super_admin', PLATFORM_GROUP),
  user(BOB, 'Bob', 'super_admin', PLATFORM_GROUP),
  user(CAROL, 'Carol', 'company_admin', PLATFORM_GROUP),
  user(DAVE, 'Dave', 'regular_user', PLATFORM_GROUP),
  user(ERIN, 'Erin', 'company_admin', CLIENT_GROUP),
  user(FRANK, 'Frank', 'regular_user', CLIENT_GROUP),
];

// What passport puts on `req.user`: the stored user's JSON.
function actorFrom(record) {
  return {
    id: String(record._id),
    name: record.name,
    email: record.email,
    role: record.role,
    isAdmin: record.role === 'super_admin',
    isGroupAdmin: record.role === 'company_admin',
    group: { id: String(record._company) },
  };
}

// The bootstrap account: an admin outside the database.
const bootstrap = Object.freeze({
  id: config.admin.id,
  isAdmin: true,
  name: 'admin',
});

function call(handler, { user, params = {}, body = {}, query = {} }) {
  return new Promise((resolve) => {
    const res = {
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        resolve({ status: this.statusCode || 200, body: payload });
      },
      send(payload) {
        resolve({ status: this.statusCode || 200, body: payload });
      },
    };
    handler({ user, params, body, query }, res, (err) =>
      resolve({ status: err.status, error: err.message })
    );
  });
}

function expectRefusal(result, status, code) {
  expect(result).toEqual({ status, error: code });
}

// A company admin of another group is refused whichever rule fires first:
// the super admin guardrail or the scoping of a company admin to their own
// group. The contract pins the refusal, not its code.
function expectRefusedOutright(result) {
  expect(result.status).toBe(403);
}

// What a client reads back after an action, through the user controller.
function readUserVia(controller) {
  return async (userId) => {
    const { body } = await call(controller.read, {
      user: bootstrap,
      params: { userId },
    });
    return body;
  };
}

function withDeactivated(id) {
  return USERS.map((u) => (u._id === id ? { ...u, isDeactivated: true } : u));
}

module.exports = {
  PLATFORM_GROUP,
  CLIENT_GROUP,
  ALICE,
  BOB,
  CAROL,
  DAVE,
  ERIN,
  FRANK,
  GROUPS,
  USERS,
  actorFrom,
  bootstrap,
  call,
  expectRefusal,
  expectRefusedOutright,
  readUserVia,
  withDeactivated,
};
