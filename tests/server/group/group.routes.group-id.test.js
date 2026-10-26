'use strict';

// A page reloaded without a group in hand used to call `/groups/undefined/…`,
// which reached the controllers and failed on the cast of the id: a server
// error. Every group route refuses an id that is not one with a client error
// instead, before any controller or guard reads it.
//
// Controllers and guards are stand-ins that answer 200: the test pins the
// router's own refusal, not what each route does.

jest.mock(
  '../../../packages/server/group/group.controller.js',
  () =>
    new Proxy(
      {},
      { get: () => (_req, res) => res.status(200).json({ reached: true }) }
    )
);
jest.mock('../../../packages/server/group/group.guard.js', () => ({
  GUARD_CAN_ACCESS_GROUP: (_req, _res, next) => next(),
}));
jest.mock('../../../packages/server/account/auth.guard.js', () => {
  const pass = (_req, _res, next) => next();
  return {
    GUARD_ADMIN: pass,
    GUARD_GROUP_ADMIN: pass,
    GUARD_GROUP_ADMIN_OR_TECH: pass,
    GUARD_USER: pass,
    guard: () => pass,
  };
});

const express = require('express');
const request = require('../../helpers/local-request.js');

const VALID_GROUP = '507f1f77bcf86cd799439b01';

describe('group routes refuse an invalid group id', () => {
  let groupRouter;

  beforeAll(() => {
    // Required here so the suite loads with the stand-ins above.
    groupRouter = require('../../../packages/server/group/group.routes.js');
  });

  function app() {
    const server = express();
    server.use(express.json());
    server.use('/api/groups', groupRouter);
    server.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
    return server;
  }

  it.each([
    ['get', '/api/groups/undefined'],
    ['get', '/api/groups/undefined/workspaces'],
    ['get', '/api/groups/undefined/users'],
    ['get', '/api/groups/undefined/mailings'],
    ['get', '/api/groups/not-an-id/email-groups'],
    ['put', '/api/groups/null'],
    ['put', '/api/groups/undefined/platform'],
    ['delete', '/api/groups/undefined'],
  ])('%s %s answers a client error', async (method, path) => {
    const res = await request(app())[method](path).send({});

    expect(res.status).toBe(400);
    expect(res.body.reached).toBeUndefined();
  });

  it('lets a valid group id through to its route', async () => {
    const res = await request(app()).get(`/api/groups/${VALID_GROUP}`);

    expect(res.status).toBe(200);
    expect(res.body.reached).toBe(true);
  });
});
