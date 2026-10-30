'use strict';

// Shared by the PUT /groups/:groupId tests of the company's switches
// (two-factor authentication, MCP access): the mocked database and
// collaborators, the stored group, the driver that runs the controller, and
// the guards the route puts before it.
//
// Required before anything it mocks: the jest.mock calls below register on the
// test's module registry when this file loads.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Groups: { findById: jest.fn(), findOneAndUpdate: jest.fn() },
  SecurityEvents: { create: jest.fn() },
  Profiles: {},
  Templates: {},
  Mailings: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({
  updateGroup: jest.fn(),
  findUserByGroupId: jest.fn(),
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
jest.mock(
  '../../../packages/server/ai-skill/services/invocation-log.service.js',
  () => ({ restampRetention: jest.fn() })
);
jest.mock('../../../packages/server/mcp/mcp-retention.js', () => ({
  restampMcpRetention: jest.fn(),
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Groups,
  SecurityEvents,
} = require('../../../packages/server/common/models.common.js');
const groupService = require('../../../packages/server/group/group.service.js');
const groupController = require('../../../packages/server/group/group.controller.js');
const groupRouter = require('../../../packages/server/group/group.routes.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439002';
const companyAdmin = { id: 'a1', role: 'company_admin', group: GROUP_ID };
const techAdmin = { id: 'a2', role: 'company_admin_tech', group: GROUP_ID };
const superAdmin = { id: 'a3', role: 'super_admin' };
const otherTechAdmin = {
  id: 'a4',
  role: 'company_admin_tech',
  group: OTHER_GROUP_ID,
};

/**
 * The group as stored: read by the controller after the write, and what the
 * write of its switches replaces.
 */
function storedGroup(fields) {
  const group = { id: GROUP_ID, name: 'Client group', ...fields };
  Groups.findById.mockReturnValue({
    lean: jest.fn().mockResolvedValue(group),
    then: (resolve, reject) => Promise.resolve(group).then(resolve, reject),
  });
  Groups.findOneAndUpdate.mockReturnValue({
    lean: jest.fn().mockResolvedValue(group),
  });
}

/**
 * Runs the controller; answers what it writes: the update it hands to the
 * service, and the switches it sets on their own.
 */
async function update(user, body) {
  await groupController.update(
    { params: { groupId: GROUP_ID }, body, user },
    { json: jest.fn() }
  );
  const switches = Groups.findOneAndUpdate.mock.calls.map(
    ([, change]) => change.$set
  );
  return Object.assign(
    {},
    groupService.updateGroup.mock.calls[0][0],
    ...switches
  );
}

// The guards of PUT /groups/:groupId as the router declares them: every
// handler of the route but the controller, which comes last.
function putGroupGuards() {
  const layer = groupRouter.stack.find(
    ({ route }) => route && route.path === '/:groupId' && route.methods.put
  );
  return layer.route.stack.slice(0, -1).map(({ handle }) => handle);
}

/**
 * Runs the route's guards for `user` on GROUP_ID.
 *
 * @returns {Error|null} the refusal of the first guard that stops the
 *   request, null when every guard lets it through to the controller
 */
function guardRefusal(user) {
  const req = { params: { groupId: GROUP_ID }, user };
  for (const guard of putGroupGuards()) {
    let passed = false;
    let refusal = null;
    guard(req, {}, (error) => {
      passed = !error;
      refusal = error || null;
    });
    if (!passed) return refusal || new Error('stopped without an answer');
  }
  return null;
}

module.exports = {
  Groups,
  SecurityEvents,
  groupService,
  groupController,
  GROUP_ID,
  OTHER_GROUP_ID,
  companyAdmin,
  techAdmin,
  superAdmin,
  otherTechAdmin,
  storedGroup,
  update,
  guardRefusal,
};
