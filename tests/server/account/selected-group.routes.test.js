'use strict';

// The selected group (ADR 0002, amended): the group a super admin works in,
// shared by the modules and the settings. A super admin stores it on its
// account, so it survives a reload and the next login; the bootstrap account,
// which has no stored account, keeps it in its session. Every other user's
// selected group is their own group.
//
// The stored groups and accounts are the in-memory fakes of the epic: a
// selection stored by one request is read back by the next one, the way
// passport rebuilds `req.user` from the account.

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
const mongoose = require('mongoose');
const request = require('../../helpers/local-request.js');

const GroupSchema = require('../../../packages/server/group/group.schema.js');

const {
  __store: store,
} = require('../../../packages/server/common/models.common.js');
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

// Builds the request user from the stored account at every request.
function actor(id) {
  if (id === bootstrap.id) return { ...bootstrap };
  return actorFrom(store.userRecord(id));
}

describe('the selected group endpoint', () => {
  // One session per test, shared by its requests, like a browser's cookie.
  let session;

  function app(userId) {
    const server = express();
    server.use(express.json());
    server.use((req, _res, next) => {
      req.user = actor(userId);
      req.session = session;
      next();
    });
    server.use('/api/users/me/selected-group', selectedGroupRouter);
    server.use((err, _req, res, _next) => {
      res.status(err.status || 500).json({ message: err.message });
    });
    return server;
  }

  const read = (userId) =>
    request(app(userId)).get('/api/users/me/selected-group');
  const select = (userId, groupId) =>
    request(app(userId)).put('/api/users/me/selected-group').send({ groupId });

  beforeEach(() => {
    jest.clearAllMocks();
    session = {};
    seed([PLATFORM, ACME, BETA]);
  });

  describe('which group is selected', () => {
    it('is the group a super admin stored on its account', async () => {
      seed([PLATFORM, ACME, BETA], { [ALICE]: CLIENT_GROUP });

      const res = await read(ALICE);

      expect(res.status).toBe(200);
      expect(res.body.selectedGroup).toMatchObject({
        id: CLIENT_GROUP,
        name: 'Acme',
      });
    });

    it('falls back to the platform group when a super admin stored none', async () => {
      const res = await read(ALICE);

      expect(res.body.selectedGroup).toMatchObject({ id: PLATFORM_GROUP });
    });

    it('falls back to the platform group when the stored group is gone', async () => {
      seed([PLATFORM, ACME, BETA], { [ALICE]: DELETED_GROUP });

      const res = await read(ALICE);

      expect(res.body.selectedGroup).toMatchObject({ id: PLATFORM_GROUP });
    });

    it('falls back to the first group by name when there is no platform group', async () => {
      seed([BETA, ACME]);

      const res = await read(ALICE);

      expect(res.body.selectedGroup).toMatchObject({ id: CLIENT_GROUP });
    });

    it('is none when no group exists at all', async () => {
      seed([]);

      const res = await read(ALICE);

      expect(res.status).toBe(200);
      expect(res.body.selectedGroup).toBeNull();
    });

    it('is the group the bootstrap account chose in this session', async () => {
      await select(bootstrap.id, OTHER_CLIENT_GROUP);

      const res = await read(bootstrap.id);

      expect(res.body.selectedGroup).toMatchObject({ id: OTHER_CLIENT_GROUP });
    });

    it('is none for the bootstrap account before it chooses one, so its settings button opens the groups list', async () => {
      const res = await read(bootstrap.id);

      expect(res.body.selectedGroup).toBeNull();
    });

    it("is a company admin's own group", async () => {
      const res = await read(ERIN);

      expect(res.body.selectedGroup).toMatchObject({ id: CLIENT_GROUP });
    });

    it("is a regular user's own group", async () => {
      const res = await read(FRANK);

      expect(res.body.selectedGroup).toMatchObject({ id: CLIENT_GROUP });
    });
  });

  describe('the module flags of the selected group', () => {
    it("are the group's stored flags", async () => {
      seed(
        [{ ...ACME, enableEmailBuilder: false, enableCrmIntelligence: true }],
        { [ALICE]: CLIENT_GROUP }
      );

      const res = await read(ALICE);

      expect(res.body.selectedGroup).toMatchObject({
        enableEmailBuilder: false,
        enableCrmIntelligence: true,
      });
    });

    it('follow the defaults of a group stored before the flags existed: Email Builder on, the others off', async () => {
      seed([ACME], { [ALICE]: CLIENT_GROUP });
      // The stored record has no flag at all: read through the real Group
      // schema, as Mongoose returns it, the defaults fill them in.
      const GroupDocument = mongoose.model(
        'GroupSelectedGroupTest',
        GroupSchema
      );
      const stored = GroupDocument.hydrate({ ...ACME });
      const findById = jest
        .spyOn(store.Groups, 'findById')
        .mockImplementation(() => {
          const chain = {
            select: () => chain,
            then: (resolve, reject) =>
              Promise.resolve(stored).then(resolve, reject),
          };
          return chain;
        });

      const res = await read(ALICE);
      findById.mockRestore();

      expect(res.body.selectedGroup).toMatchObject({
        enableEmailBuilder: true,
        enableCrmIntelligence: false,
        downloadMailingWithFtpImages: false,
      });
    });
  });

  describe('selecting a group', () => {
    it('stores it on the account of a super admin, for the next requests', async () => {
      const res = await select(ALICE, OTHER_CLIENT_GROUP);

      expect(res.status).toBe(200);
      expect(res.body.selectedGroup).toMatchObject({
        id: OTHER_CLIENT_GROUP,
        name: 'Beta',
      });
      expect((await read(ALICE)).body.selectedGroup).toMatchObject({
        id: OTHER_CLIENT_GROUP,
      });
    });

    it('keeps it in the session of the bootstrap account, which has no stored account', async () => {
      const res = await select(bootstrap.id, CLIENT_GROUP);

      expect(res.status).toBe(200);
      expect((await read(bootstrap.id)).body.selectedGroup).toMatchObject({
        id: CLIENT_GROUP,
      });
      session = {};
      expect((await read(bootstrap.id)).body.selectedGroup).toBeNull();
    });

    it('refuses a company admin, whose selected group is their own', async () => {
      const res = await select(ERIN, PLATFORM_GROUP);

      expect(res.status).toBe(403);
      expect((await read(ERIN)).body.selectedGroup).toMatchObject({
        id: CLIENT_GROUP,
      });
    });

    it('refuses a regular user', async () => {
      const res = await select(FRANK, PLATFORM_GROUP);

      expect(res.status).toBe(403);
    });

    it('refuses a group that does not exist', async () => {
      const res = await select(ALICE, DELETED_GROUP);

      expect(res.status).toBe(404);
      expect((await read(ALICE)).body.selectedGroup).toMatchObject({
        id: PLATFORM_GROUP,
      });
    });

    it.each([['undefined'], ['not-an-id'], [undefined]])(
      'refuses the group id %p with a client error, never a server error',
      async (groupId) => {
        const res = await select(ALICE, groupId);

        expect(res.status).toBe(400);
      }
    );
  });
});
