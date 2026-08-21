'use strict';

// Reads are open to any user (filling in an email's metadata needs the list),
// writes are company-admin only. That split is a one-word difference per line in
// the routes file and nothing else in the codebase would notice if a write route
// lost its guard — so the guards are pinned here by identity, on the actual
// express stack rather than on the source text.

const {
  GUARD_USER,
  GUARD_GROUP_ADMIN,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_CAN_ACCESS_GROUP,
} = require('../../../packages/server/group/group.guard.js');
const router = require('../../../packages/server/taxonomy/taxonomy.routes.js');

// Express keeps one layer per `router.<method>()` call; `route.stack` holds the
// handlers of that layer, guards first, controller last.
function layerFor(method, path) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route &&
      candidate.route.path === path &&
      candidate.route.methods[method]
  );
  if (!layer) {
    throw new Error(`no ${method.toUpperCase()} ${path} route declared`);
  }
  return layer;
}

const guardsOf = (method, path) =>
  layerFor(method, path)
    .route.stack.map((handler) => handler.handle)
    .slice(0, -1);

describe('taxonomy routes — declared surface', () => {
  it.each([
    ['get', ''],
    ['get', '/groups/:groupId'],
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

  it.each([
    ['post', ''],
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('reserves %s %s to a company admin', (method, path) => {
    expect(guardsOf(method, path)).toEqual([GUARD_GROUP_ADMIN]);
  });

  it.each([
    ['post', ''],
    ['patch', '/:itemId'],
    ['delete', '/:itemId'],
  ])('never leaves %s %s guarded by GUARD_USER alone', (method, path) => {
    expect(guardsOf(method, path)).not.toContain(GUARD_USER);
  });
});
