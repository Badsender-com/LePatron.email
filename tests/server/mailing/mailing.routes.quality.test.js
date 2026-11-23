'use strict';

// The quality routes act on what the request carries. A plain HTML form posted
// from another site rides with the session cookie, so both require a JSON body
// (utils/require-json-body.js). Guards are compared by identity on the actual
// express stack, as mailing.routes.metadata.test.js does.

const {
  GUARD_CAN,
  GUARD_USER,
} = require('../../../packages/server/account/auth.guard.js');
const {
  CAPABILITIES,
  ROLES,
} = require('../../../packages/shared/access/roles.js');
const {
  requireJsonBody,
} = require('../../../packages/server/utils/require-json-body.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');

const { guardsOf } = routeInspector(router);

describe('mailing routes — the quality endpoints take JSON only', () => {
  it.each([
    [
      'patch',
      '/:mailingId/quality-ignores',
      GUARD_CAN(CAPABILITIES.MAILING_IGNORE_QUALITY),
    ],
    ['post', '/:mailingId/quality/resources', GUARD_USER],
  ])('%s %s requires a JSON body', (method, path, guard) => {
    expect(guardsOf(method, path)).toEqual([guard, requireJsonBody]);
  });
});

// An ignored finding is hidden for everyone who works on the email: the
// authors decide it, not the writer nor the reviewer
// (docs/plans/rbac-refonte.md, row 25).
const MAY_IGNORE = {
  [ROLES.SUPER_ADMIN]: true,
  [ROLES.GROUP_ADMIN_TECH]: true,
  [ROLES.GROUP_ADMIN]: true,
  [ROLES.REGULAR_USER]: true,
  [ROLES.WRITER]: false,
  [ROLES.REVIEWER]: false,
};

describe('PATCH /:mailingId/quality-ignores, for each role', () => {
  // The route's own guard, as express runs it before the controller.
  function passGuard(role) {
    const [capabilityGuard] = guardsOf('patch', '/:mailingId/quality-ignores');
    const next = jest.fn();
    capabilityGuard({ user: { id: 'user-1', role } }, {}, next);
    return next.mock.calls[0][0];
  }

  it('covers every role', () => {
    expect(Object.keys(MAY_IGNORE).sort()).toEqual(Object.values(ROLES).sort());
  });

  it.each(Object.values(ROLES).filter((role) => MAY_IGNORE[role]))(
    'lets a %s ignore a finding',
    (role) => {
      expect(passGuard(role)).toBeUndefined();
    }
  );

  it.each(Object.values(ROLES).filter((role) => !MAY_IGNORE[role]))(
    'refuses a %s with a 403, before the email is read',
    (role) => {
      const error = passGuard(role);

      expect(error.status).toBe(403);
      expect(error.message).toBe('FORBIDDEN_CAPABILITY');
    }
  );
});
