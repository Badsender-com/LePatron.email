'use strict';

// Two properties are pinned here, both invisible anywhere else.
//
// The read/write split: reads are open to any user (filling in an email's metadata
// needs the list), writes are company-admin only. That is a one-word difference per
// line in the routes file, and nothing in the codebase would notice a write route
// losing its guard.
//
// And the absence of GUARD_EMAIL_METADATA: the taxonomy is deliberately NOT gated
// by the metadata flag, so an admin can prepare a company's typologies before
// switching the metadata on. Re-adding the guard "for consistency" would silently
// restore the ordering problem, hence the negative assertions below.
//
// Guards are compared by identity on the actual express stack, not on source text.

const {
  GUARD_USER,
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP,
  GUARD_CAN_ACCESS_GROUP_FROM_BODY,
  GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
} = require('../../../packages/server/group/group.guard.js');
const {
  GUARD_EMAIL_METADATA,
} = require('../../../packages/server/mailing/email-metadata.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/taxonomy/taxonomy.routes.js');

const { layerFor, guardsOf } = routeInspector(router);

describe('taxonomy routes — declared surface', () => {
  it.each([
    ['get', ''],
    ['get', '/groups/:groupId'],
    ['get', '/default-email-types'],
    ['post', '/default-email-types'],
    ['post', ''],
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('declares %s %s', (method, path) => {
    expect(() => layerFor(method, path)).not.toThrow();
  });

  it('declares the /groups/:groupId read before /:itemId', () => {
    const paths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    // Otherwise "groups" would be captured as an itemId.
    expect(paths.indexOf('/groups/:groupId')).toBeLessThan(
      paths.indexOf('/:itemId')
    );
  });

  it('declares /default-email-types before /:itemId', () => {
    const paths = router.stack
      .filter((layer) => layer.route)
      .map((layer) => layer.route.path);

    // Same trap: "default-email-types" would otherwise be read as an item id, and
    // the preview would answer a 404 about an email type nobody asked for.
    expect(paths.indexOf('/default-email-types')).toBeLessThan(
      paths.indexOf('/:itemId')
    );
  });
});

describe('taxonomy routes — guards', () => {
  it('opens the list to any authenticated user', () => {
    expect(guardsOf('get', '')).toEqual([GUARD_USER]);
  });

  it('checks company access on the per-company list', () => {
    expect(guardsOf('get', '/groups/:groupId')).toEqual([
      GUARD_USER,
      GUARD_CAN_ACCESS_GROUP,
    ]);
  });

  it('reserves the create to a company admin, and checks the target company', () => {
    expect(guardsOf('post', '')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_BODY,
    ]);
  });

  it.each([
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('reserves %s %s to a company admin', (method, path) => {
    expect(guardsOf(method, path)).toEqual([GUARD_GROUP_ADMIN]);
  });

  // Company admin on the READ too, unlike the listing above. This one answers what
  // a company does NOT have, which is a configuration question — not something a
  // user filling in an email's metadata has any use for.
  it('reserves the defaults preview to a company admin, and checks the query company', () => {
    expect(guardsOf('get', '/default-email-types')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_QUERY,
    ]);
  });

  it('reserves the defaults restore to a company admin, and checks the body company', () => {
    expect(guardsOf('post', '/default-email-types')).toEqual([
      GUARD_GROUP_ADMIN,
      GUARD_CAN_ACCESS_GROUP_FROM_BODY,
    ]);
  });

  // The taxonomy stays usable whether or not a company switched the metadata on:
  // typologies have to be preparable first, and CRM Governance will read them
  // regardless of the email builder.
  it.each([
    ['get', ''],
    ['get', '/groups/:groupId'],
    ['get', '/default-email-types'],
    ['post', '/default-email-types'],
    ['post', ''],
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('leaves %s %s reachable with the metadata flag off', (method, path) => {
    expect(guardsOf(method, path)).not.toContain(GUARD_EMAIL_METADATA);
  });

  it.each([
    ['post', ''],
    ['post', '/default-email-types'],
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('never leaves %s %s guarded by GUARD_USER alone', (method, path) => {
    expect(guardsOf(method, path)).not.toContain(GUARD_USER);
  });
});
