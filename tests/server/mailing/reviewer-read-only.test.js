'use strict';

// A reviewer reads, comments, approves and sends tests; the routes that write a
// mailing refuse them, so that the restriction holds when the API is called
// directly and not only through the editor. The writer is not concerned (ADR
// 0004). Guards are compared by identity on the actual express stack.

const {
  GUARD_NOT_REVIEWER,
} = require('../../../packages/server/mailing/reviewer-read-only.guard.js');
const { routeInspector } = require('../../helpers/express-router.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');

const { guardsOf } = routeInspector(router);

const run = (user) =>
  new Promise((resolve) => {
    GUARD_NOT_REVIEWER({ user }, {}, (err) => resolve(err));
  });

describe('GUARD_NOT_REVIEWER', () => {
  it('refuses a reviewer with its own code', async () => {
    const err = await run({ role: 'reviewer' });

    expect(err.status).toBe(403);
    expect(err.message).toBe('FORBIDDEN_REVIEWER_READ_ONLY');
  });

  it.each([
    'writer',
    'regular_user',
    'company_admin',
    'company_admin_tech',
    'super_admin',
  ])('lets a %s through', async (role) => {
    expect(await run({ role })).toBeUndefined();
  });

  it('lets the bootstrap account through', async () => {
    expect(await run({ isAdmin: true })).toBeUndefined();
  });
});

describe('the routes that write a mailing', () => {
  it.each([
    ['post', ''],
    ['patch', '/:mailingId'],
    ['delete', '/:mailingId'],
    ['post', '/copy'],
    ['post', '/:mailingId/move'],
    ['post', '/move-many'],
    ['patch', '/:mailingId/metadata'],
    ['post', '/:mailingId/duplicate'],
    ['post', '/:mailingId/duplicate-translate'],
    ['put', ''],
  ])('refuse a reviewer: %s %s', (method, path) => {
    expect(guardsOf(method, path)).toContain(GUARD_NOT_REVIEWER);
  });

  // The save of a mailing is checked in the controller: a reviewer may only run
  // the one the editor makes on opening a mailing that has no preview yet.
  it.each([
    ['get', ''],
    ['get', '/:mailingId'],
    ['get', '/:mailingId/mosaico'],
    ['get', '/:mailingId/preview'],
    ['put', '/:mailingId/mosaico'],
    ['post', '/:mailingId/mosaico/send-test-mail'],
    ['post', '/:mailingId/mosaico/download-zip'],
  ])('do not refuse a reviewer at the router: %s %s', (method, path) => {
    expect(guardsOf(method, path)).not.toContain(GUARD_NOT_REVIEWER);
  });
});
