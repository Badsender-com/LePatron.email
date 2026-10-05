'use strict';

// One active session per account: a login records its session id on the
// user, and a request whose session is not the recorded one is logged out.
// Both steps skip "admin" users, which until now meant the bootstrap account
// only: a frozen object with nothing to record. With super admin as a
// persisted role (ADR 0002) that exemption stays with the bootstrap account
// alone; a persisted super admin is tracked like any user.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return { Users: store.Users, Groups: store.Groups, __store: store };
});
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
const {
  updateSessionTracking,
} = require('../../../packages/server/account/session-tracking.helper.js');
const sessionValidationMiddleware = require('../../../packages/server/account/session-validation.middleware.js');
const {
  ALICE,
  DAVE,
  GROUPS,
  USERS,
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const actor = (id) => actorFrom(store.userRecord(id));

function loginRequest(sessionID) {
  return {
    sessionID,
    ip: '203.0.113.7',
    connection: {},
    get: () => 'jest',
  };
}

// Resolves with `{ next: true }` when the request goes through, or with the
// redirect target when the session is destroyed.
function validate(user, sessionID) {
  return new Promise((resolve) => {
    const req = {
      isAuthenticated: () => true,
      user,
      sessionID,
      session: { destroy: (done) => done() },
    };
    const res = {
      cookie: () => res,
      redirect: (url) => resolve({ redirectedTo: url }),
    };
    sessionValidationMiddleware()(req, res, () => resolve({ next: true }));
  });
}

beforeEach(() => {
  store.seed({
    groups: GROUPS,
    users: USERS.map((u) => ({ ...u, activeSessionId: 'sess-recorded' })),
  });
});

describe('session tracking', () => {
  describe('a persisted regular user', () => {
    it('has the login session recorded', async () => {
      await updateSessionTracking(loginRequest('sess-new'), actor(DAVE));

      expect(store.userRecord(DAVE).activeSessionId).toBe('sess-new');
    });

    it('is logged out when the request is not from the recorded session', async () => {
      expect(await validate(actor(DAVE), 'sess-other')).toEqual({
        redirectedTo: '/account/login',
      });
    });

    it('goes through from the recorded session', async () => {
      expect(await validate(actor(DAVE), 'sess-recorded')).toEqual({
        next: true,
      });
    });
  });

  describe('the bootstrap account', () => {
    it('records nothing at login', async () => {
      await updateSessionTracking(loginRequest('sess-new'), { ...bootstrap });

      expect(USERS.map((u) => store.userRecord(u._id).activeSessionId)).toEqual(
        USERS.map(() => 'sess-recorded')
      );
    });

    it('is never logged out for a session mismatch', async () => {
      expect(await validate({ ...bootstrap }, 'sess-anything')).toEqual({
        next: true,
      });
    });
  });

  // Turned on by #1155 (super admin as a persisted role: admin status,
  // guardrails and listing).
  describe.skip('a persisted super admin (#1155)', () => {
    it('has the login session recorded, like any user', async () => {
      await updateSessionTracking(loginRequest('sess-new'), actor(ALICE));

      expect(store.userRecord(ALICE).activeSessionId).toBe('sess-new');
    });

    it('is logged out when the request is not from the recorded session', async () => {
      expect(await validate(actor(ALICE), 'sess-other')).toEqual({
        redirectedTo: '/account/login',
      });
    });

    it('goes through from the recorded session', async () => {
      expect(await validate(actor(ALICE), 'sess-recorded')).toEqual({
        next: true,
      });
    });
  });
});
