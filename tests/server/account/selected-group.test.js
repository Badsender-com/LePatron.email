'use strict';

// The selected group on every request (ADR 0002, amended). A middleware puts
// the resolved selected group on `req.user`, so the scope of a module request
// and the module guards read one value: the group a super admin stored, else
// the platform group, else the first group by name; the group the bootstrap
// account chose in its session, with no fallback; anyone else's own group.
// Nothing else resolves it, so a stored group that was deleted never reaches
// a listing.

jest.mock('../../../packages/server/common/models.common.js', () => {
  const { createStore } = require('../../helpers/fake-user-models.js');
  const store = createStore();
  return {
    Users: store.Users,
    Groups: store.Groups,
    Mailings: store.Mailings,
    OAuthClients: {},
    OAuthTokens: {},
    __store: store,
  };
});
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
const {
  attachSelectedGroup,
  forgetSessionSelection,
} = require('../../../packages/server/account/selected-group.js');
const selectedGroupRouter = require('../../../packages/server/account/selected-group.routes.js');
const {
  ALICE,
  ERIN,
  FRANK,
  USERS,
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const CLIENT_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_CLIENT_GROUP = '507f1f77bcf86cd799439b02';
const DELETED_GROUP = '507f1f77bcf86cd799439b99';

const PLATFORM = { _id: PLATFORM_GROUP, name: 'Platform', isPlatform: true };
const ACME = { _id: CLIENT_GROUP, name: 'Acme' };
const BETA = { _id: OTHER_CLIENT_GROUP, name: 'Beta' };

const seed = (groups, selections = {}) =>
  store.seed({
    groups,
    users: USERS.map((u) =>
      selections[u._id] ? { ...u, _selectedGroup: selections[u._id] } : u
    ),
  });

function actor(id) {
  if (id === bootstrap.id) return { ...bootstrap };
  return actorFrom(store.userRecord(id));
}

describe('the selected group on every request', () => {
  let session;

  // An app whose probe route answers the selected group the request carries.
  function app(userId) {
    const server = express();
    server.use(express.json());
    server.use((req, _res, next) => {
      req.user = actor(userId);
      req.session = session;
      next();
    });
    server.use('/api/users/me/selected-group', selectedGroupRouter);
    server.get('/sign-out', (req, res) => {
      forgetSessionSelection(req);
      res.json({});
    });
    server.use(attachSelectedGroup);
    server.get('/probe', (req, res) =>
      res.json({
        selectedGroupId: req.user.selectedGroup
          ? String(req.user.selectedGroup.id)
          : null,
      })
    );
    server.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
    return server;
  }

  const probe = async (userId) =>
    (await request(app(userId)).get('/probe')).body.selectedGroupId;

  beforeEach(() => {
    session = {};
    seed([PLATFORM, ACME, BETA]);
  });

  it('carries the group a super admin stored', async () => {
    seed([PLATFORM, ACME, BETA], { [ALICE]: CLIENT_GROUP });

    expect(await probe(ALICE)).toBe(CLIENT_GROUP);
  });

  it('carries the platform group when a super admin stored none', async () => {
    expect(await probe(ALICE)).toBe(PLATFORM_GROUP);
  });

  it('carries the platform group when the stored group is gone', async () => {
    seed([PLATFORM, ACME, BETA], { [ALICE]: DELETED_GROUP });

    expect(await probe(ALICE)).toBe(PLATFORM_GROUP);
  });

  it('carries the first group by name when there is no platform group', async () => {
    seed([BETA, ACME]);

    expect(await probe(ALICE)).toBe(CLIENT_GROUP);
  });

  it('carries none for a super admin when no group exists', async () => {
    seed([]);

    expect(await probe(ALICE)).toBeNull();
  });

  it('carries the group the bootstrap account chose in its session', async () => {
    await request(app(bootstrap.id))
      .put('/api/users/me/selected-group')
      .send({ groupId: OTHER_CLIENT_GROUP });

    expect(await probe(bootstrap.id)).toBe(OTHER_CLIENT_GROUP);
  });

  it('carries none for the bootstrap account before it chooses, with no fallback', async () => {
    expect(await probe(bootstrap.id)).toBeNull();
  });

  it("carries a company admin's own group", async () => {
    expect(await probe(ERIN)).toBe(CLIENT_GROUP);
  });

  it("carries a regular user's own group, even with a group stored on the account", async () => {
    seed([PLATFORM, ACME, BETA], { [FRANK]: PLATFORM_GROUP });

    expect(await probe(FRANK)).toBe(CLIENT_GROUP);
  });

  it("forgets the bootstrap account's choice when it signs out or in again", async () => {
    await request(app(bootstrap.id))
      .put('/api/users/me/selected-group')
      .send({ groupId: OTHER_CLIENT_GROUP });

    await request(app(bootstrap.id)).get('/sign-out');

    expect(await probe(bootstrap.id)).toBeNull();
  });

  it('lets the request go on without a selected group when the lookup fails', async () => {
    seed([PLATFORM, ACME, BETA], { [ALICE]: CLIENT_GROUP });
    const findById = jest
      .spyOn(store.Groups, 'findById')
      .mockImplementation(() => {
        throw new Error('database down');
      });

    const res = await request(app(ALICE)).get('/probe');

    findById.mockRestore();
    expect(res.status).toBe(200);
    expect(res.body.selectedGroupId).toBeNull();
  });
});
