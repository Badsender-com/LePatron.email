'use strict';

// Searching every accessible workspace is a read (epic #1144, ADR 0007): it
// sits behind the listing's guards, a signed-in user and the Email Builder
// module, and declares no capability (ADR 0004). Which emails come back is
// the service's business (mailing-search.service.test.js), the bootstrap
// account's refusal included. Guards are compared by identity on the actual
// express stack, not on source text.

const {
  GUARD_USER,
} = require('../../../packages/server/account/auth.guard.js');
const {
  GUARD_EMAIL_BUILDER,
} = require('../../../packages/server/mailing/email-builder.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');

const { layerFor, guardsOf } = routeInspector(router);

const indexOf = (method, path) => router.stack.indexOf(layerFor(method, path));

// Turned on by #1314 (search every accessible workspace)
describe.skip('mailing routes — the search', () => {
  it('declares GET /search', () => {
    expect(() => layerFor('get', '/search')).not.toThrow();
  });

  it('is guarded like the listing of a location, with no capability', () => {
    expect(guardsOf('get', '/search')).toEqual([GUARD_USER]);
    expect(guardsOf('get', '/search')).toEqual(guardsOf('get', ''));
  });

  it('sits behind the Email Builder module, as every mailing route does', () => {
    const moduleGuard = router.stack.findIndex(
      (layer) => !layer.route && layer.handle === GUARD_EMAIL_BUILDER
    );

    expect(moduleGuard).toBeGreaterThanOrEqual(0);
    expect(moduleGuard).toBeLessThan(indexOf('get', '/search'));
  });

  // Express matches in declaration order: declared after `/:mailingId`, the
  // search would be read as the email whose id is "search".
  it('is declared before GET /:mailingId', () => {
    expect(indexOf('get', '/search')).toBeLessThan(
      indexOf('get', '/:mailingId')
    );
  });
});
