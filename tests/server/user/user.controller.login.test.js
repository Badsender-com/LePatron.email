'use strict';

// The sign-in answer is what the UI stores before it navigates, without a new
// server render: it carries the user's capabilities, as every later request
// user does, or the screens it opens hide every action until a reload.

jest.mock('passport', () => ({ authenticate: jest.fn() }));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: { findOneForApi: jest.fn() },
  Mailings: {},
  Groups: {},
}));
jest.mock(
  '../../../packages/server/account/session-tracking.helper.js',
  () => ({
    updateSessionTracking: jest.fn(),
  })
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
const { Users } = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/user/user.controller.js');
const {
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');

function signIn(storedUser) {
  passport.authenticate.mockImplementation((_strategy, callback) => () =>
    callback(null, { _id: 'u1', id: 'u1' }, null)
  );
  Users.findOneForApi.mockResolvedValue({ toJSON: () => storedUser });
  return new Promise((resolve, reject) => {
    const req = {
      session: { save: (done) => done() },
      logIn: (_user, done) => done(),
    };
    controller.login(req, { json: resolve }, reject);
  });
}

describe('POST /account/login', () => {
  it("answers with the user's capabilities", async () => {
    const payload = await signIn({ id: 'u1', role: 'writer' });

    expect(payload.capabilities).toEqual(capabilitiesOfRole('writer'));
    expect(payload.role).toBe('writer');
  });
});
