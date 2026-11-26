'use strict';

// The guards of the dimension routes (epic #1351).
//
// Company admins and tech admins manage the whole taxonomy, with no split
// between them (decided during the grilling of the epic). Regular users never
// read this resource: they receive the active dimensions of their company with
// the email they are editing.
//
// Guards are compared by identity on the actual express stack, not on source
// text, like the neighbouring taxonomy.routes.test.js.

const {
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../../../packages/server/group/group.guard.js');
const {
  GUARD_EMAIL_METADATA,
} = require('../../../packages/server/mailing/email-metadata.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');

// Turned on by #1353 (dimensions are records; the email type and the trigger as
// standard dimensions)
describe('dimension routes', () => {
  let layerFor;
  let guardsOf;

  beforeAll(() => {
    // Required here, not at the top of the file: the router doesn't exist until
    // #1353 ships it.
    const router = require('../../../packages/server/taxonomy/dimension.routes.js');
    ({ layerFor, guardsOf } = routeInspector(router));
  });

  it.each([
    ['get', ''],
    ['post', ''],
    ['patch', '/:dimensionId'],
    ['delete', '/:dimensionId'],
  ])('declares %s %s', (method, path) => {
    expect(() => layerFor(method, path)).not.toThrow();
  });

  it('reserves the list to admins of the company it names', () => {
    expect(guardsOf('get', '')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
    ]);
  });

  it('reserves declaring a dimension to admins of the company it names', () => {
    expect(guardsOf('post', '')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_BODY,
    ]);
  });

  it.each(['patch', 'delete'])(
    'reserves %s to admins; the service scopes the dimension to their company',
    (method) => {
      expect(guardsOf(method, '/:dimensionId')).toEqual([GUARD_GROUP_ADMIN]);
    }
  );

  it('is not gated by the email metadata switch, so a company is prepared before it is on', () => {
    ['get', 'post'].forEach((method) =>
      expect(guardsOf(method, '')).not.toContain(GUARD_EMAIL_METADATA)
    );
  });

  // The guards run as express runs them, for each of the six roles: a request
  // reaches the controller only if every guard calls `next()` without an error.
  describe('who gets through', () => {
    const COMPANY_A = '507f1f77bcf86cd799439a01';
    const COMPANY_B = '507f1f77bcf86cd799439b01';
    const PLATFORM = '507f1f77bcf86cd799439f01';
    const DIMENSION_ID = '507f1f77bcf86cd799439d01';

    const userOf = (role) => ({
      role,
      group: { id: role === 'super_admin' ? PLATFORM : COMPANY_A },
    });

    const requestFor = (method, user, groupId) => {
      if (method === 'get') return { user, query: { groupId } };
      if (method === 'post') return { user, body: { groupId } };
      return { user, params: { dimensionId: DIMENSION_ID } };
    };

    const reachesController = (method, path, req) =>
      guardsOf(method, path).every((guard) => {
        let passed = false;
        guard(req, {}, (error) => {
          passed = !error;
        });
        return passed;
      });

    const ROUTES = [
      ['get', ''],
      ['post', ''],
      ['patch', '/:dimensionId'],
      ['delete', '/:dimensionId'],
    ];

    describe.each([
      ['super_admin', true],
      ['company_admin_tech', true],
      ['company_admin', true],
      ['regular_user', false],
      ['writer', false],
      ['reviewer', false],
    ])('a %s', (role, allowed) => {
      it.each(ROUTES)(
        `${allowed ? 'reaches' : 'is refused'} %s %s for company A`,
        (method, path) => {
          expect(
            reachesController(
              method,
              path,
              requestFor(method, userOf(role), COMPANY_A)
            )
          ).toBe(allowed);
        }
      );
    });

    it.each([['get'], ['post']])(
      "refuses %s to an admin of company A naming company B's id",
      (method) => {
        ['company_admin', 'company_admin_tech'].forEach((role) => {
          expect(
            reachesController(
              method,
              '',
              requestFor(method, userOf(role), COMPANY_B)
            )
          ).toBe(false);
        });
      }
    );

    it.each([['get'], ['post']])(
      'lets a super admin name company B on %s',
      (method) => {
        expect(
          reachesController(
            method,
            '',
            requestFor(method, userOf('super_admin'), COMPANY_B)
          )
        ).toBe(true);
      }
    );
  });
});
