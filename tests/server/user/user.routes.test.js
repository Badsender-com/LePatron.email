'use strict';

// Route protection is one word per route in the routes file, and nothing
// else notices a route losing its guard. The user listing is the one route
// of the file reserved to admins: with super admin as a persisted role (ADR
// 0002) it also serves the super admins screen, so it stays behind the admin
// guard, and every other user route stays behind the shared company admin
// guard mounted above them.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Users: {},
  Groups: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const router = require('../../../packages/server/user/user.routes.js');
const {
  GUARD_ADMIN,
  adminUser,
} = require('../../../packages/server/account/auth.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');

const { guardsOf } = routeInspector(router);

describe('user routes', () => {
  it('keeps the user listing behind the admin guard', () => {
    expect(guardsOf('get', '')).toEqual([GUARD_ADMIN]);
  });

  describe('the shared guard of the user management routes', () => {
    const shared = router.stack.findIndex((layer) => layer.route?.path === '*');
    const firstManagementRoute = router.stack.findIndex(
      (layer) => layer.route?.path === '/:userId'
    );

    function runShared(user) {
      return new Promise((resolve) => {
        router.stack[shared].route.stack[0].handle({ user }, {}, (err) =>
          resolve(err)
        );
      });
    }

    it('is mounted before them', () => {
      expect(shared).toBeGreaterThan(-1);
      expect(shared).toBeLessThan(firstManagementRoute);
    });

    it('rejects a regular user', async () => {
      const err = await runShared({ isAdmin: false, isGroupAdmin: false });

      expect(err.status).toBe(401);
    });

    it('lets a company admin through', async () => {
      expect(await runShared({ isGroupAdmin: true })).toBeUndefined();
    });

    it('lets the bootstrap account through', async () => {
      expect(await runShared({ ...adminUser })).toBeUndefined();
    });
  });
});
