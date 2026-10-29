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
const permissions = require('../../../packages/server/account/permissions.js');
const { CAPABILITIES } = require('../../../packages/shared/access/roles.js');
const { routeInspector } = require('../../helpers/express-router.js');

// Turned on by #1353 (dimensions are records; the email type and the trigger as
// standard dimensions)
describe.skip('dimension routes', () => {
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

  it('lets a tech admin through the admin guard, and not a regular user', () => {
    expect(
      permissions.can(
        { role: 'company_admin_tech', group: { id: 'a' } },
        CAPABILITIES.GROUP_MANAGE
      )
    ).toBe(true);
    expect(
      permissions.can(
        { role: 'regular_user', group: { id: 'a' } },
        CAPABILITIES.GROUP_MANAGE
      )
    ).toBe(false);
  });
});
