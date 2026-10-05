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
} = require('../../../packages/server/account/auth.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');

const { guardsOf } = routeInspector(router);

describe('user routes', () => {
  it('keeps the user listing behind the admin guard', () => {
    expect(guardsOf('get', '')).toEqual([GUARD_ADMIN]);
  });

  it('mounts one shared guard before every user management route', () => {
    const shared = router.stack.findIndex((layer) => layer.route?.path === '*');
    const firstManagementRoute = router.stack.findIndex(
      (layer) => layer.route?.path === '/:userId'
    );

    expect(shared).toBeGreaterThan(-1);
    expect(shared).toBeLessThan(firstManagementRoute);
    expect(router.stack[shared].route.stack).toHaveLength(1);
  });
});
