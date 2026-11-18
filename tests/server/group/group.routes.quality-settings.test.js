'use strict';

// PUT /groups/:groupId with `qualitySettings`, as a client calls it: the real
// router, guards and controller, over stand-in models (epic #1193, ADR 0009).
// A super admin sets any company's quality settings, a company admin or tech
// admin their own company's; every other role, and an admin of another
// company, is refused by the route's guards before anything is written.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn() },
  Profiles: {},
  Templates: {},
  Mailings: {},
  Users: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  updateGroup: jest.fn(),
}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({
  processCredentialsForUpdate: jest.fn((body) => ({ ...body })),
  validateSshKeyOrThrow: jest.fn(),
  maskFtpCredentials: jest.fn((group) => group),
}));
jest.mock('../../../packages/server/workspace/workspace.service.js', () => ({
  createWorkspace: jest.fn(),
  findWorkspaces: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('../../helpers/local-request.js');

const { Groups } = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const {
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const OWN_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439b02';

const userWith = (role) =>
  actorFrom({
    _id: '507f1f77bcf86cd799439101',
    name: 'Someone',
    role,
    _company: OWN_GROUP,
  });

let router;
beforeAll(() => {
  // required here, once the stand-ins above are in place
  router = require('../../../packages/server/group/group.routes.js');
});

function app(user) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.user = user;
    next();
  });
  server.use('/api/groups', router);
  // the shape index.js gives a client
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

const QUALITY_SETTINGS = {
  checks: { 'emoji-placement': { state: 'off' } },
};
const put = (user, groupId) =>
  request(app(user))
    .put(`/api/groups/${groupId}`)
    .send({ qualitySettings: QUALITY_SETTINGS });

beforeEach(() => {
  jest.clearAllMocks();
  // Read with a projection and `lean()`, then whole once written.
  Groups.findById.mockImplementation((id) => ({
    lean: () => Promise.resolve({ _id: id }),
  }));
});

describe('PUT /api/groups/:groupId with quality settings — rights', () => {
  it.each([
    // who, own company, another company
    ['a super admin', 200, 200, userWith(ROLES.SUPER_ADMIN)],
    ['the bootstrap account', 200, 200, bootstrap],
    ['a tech admin', 200, 401, userWith(ROLES.GROUP_ADMIN_TECH)],
    ['a company admin', 200, 401, userWith(ROLES.GROUP_ADMIN)],
    ['a writer', 401, 401, userWith(ROLES.WRITER)],
    ['a reviewer', 401, 401, userWith(ROLES.REVIEWER)],
    ['a regular user', 401, 401, userWith(ROLES.REGULAR_USER)],
  ])(
    'answers %s with %i on its own company, %i on another',
    async (_label, own, other, user) => {
      const answers = [];
      for (const groupId of [OWN_GROUP, OTHER_GROUP]) {
        answers.push((await put(user, groupId)).status);
      }
      expect(answers).toEqual([own, other]);

      const written = groupService.updateGroup.mock.calls.map(
        ([payload]) => payload
      );
      expect(written.map(({ id }) => id)).toEqual(
        [OWN_GROUP, OTHER_GROUP].filter((_id, i) => answers[i] === 200)
      );
      written.forEach((payload) =>
        expect(payload.qualitySettings).toEqual(QUALITY_SETTINGS)
      );
    }
  );
});
