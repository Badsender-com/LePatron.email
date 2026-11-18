'use strict';

// A company admin may override the quality settings of their own group's
// templates (epic #1193): that rests on two lines, the route's guard, and the
// controller's own-group check (template.controller.quality-settings.test.js).
// The guard is read off the real router, compared by identity.

// The controller pulls image processing in (sharp); only its handlers' names
// matter to the router.
jest.mock(
  '../../../packages/server/template/template.controller.js',
  () =>
    new Proxy(
      {},
      { get: (_target, name) => (name === '__esModule' ? false : jest.fn()) }
    )
);

const {
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/template/template.routes.js');

const { guardsOf } = routeInspector(router);

describe('PUT /templates/:templateId/quality-settings — guard', () => {
  it('is open to company admins, the controller checking the group', () => {
    expect(guardsOf('put', '/:templateId/quality-settings')).toEqual([
      GUARD_GROUP_ADMIN,
    ]);
  });
});
