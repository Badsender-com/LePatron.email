'use strict';

// The quality routes act on what the request carries. A plain HTML form posted
// from another site rides with the session cookie, so both require a JSON body
// (utils/require-json-body.js). Guards are compared by identity on the actual
// express stack, as mailing.routes.metadata.test.js does.

const {
  GUARD_USER,
} = require('../../../packages/server/account/auth.guard.js');
const {
  requireJsonBody,
} = require('../../../packages/server/utils/require-json-body.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');

const { guardsOf } = routeInspector(router);

describe('mailing routes — the quality endpoints take JSON only', () => {
  it.each([
    ['patch', '/:mailingId/quality-ignores'],
    ['post', '/:mailingId/quality/resources'],
  ])('%s %s requires a JSON body', (method, path) => {
    expect(guardsOf(method, path)).toEqual([GUARD_USER, requireJsonBody]);
  });
});
