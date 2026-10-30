'use strict';

// Who may rename the label of a gallery image, played through the real route.
// The capability is gallery.manage, held by every role (ADR 0004: every role
// may use the image gallery). The scope is the gallery's parent: the gallery
// of an email follows the email's write scope, the same check as saving the
// email (its workspace, or the workspace of its folder); the gallery of a
// template follows the rule for editing a template (PUT /templates/:id, which
// asks for platform.manage).
//
// The real mailing, workspace and folder services run; the models answer like
// MongoDB would: findOne honours `_id` and `_company`.

jest.mock('sharp', () => jest.fn());
jest.mock('puppeteer', () => ({}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  CacheImages: { findOne: jest.fn() },
  Galleries: {
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    exists: jest.fn(),
  },
  Mailings: { findOne: jest.fn() },
  Templates: { findOne: jest.fn() },
  Workspaces: { exists: jest.fn(), findById: jest.fn() },
  Folders: { exists: jest.fn(), findOne: jest.fn() },
  Groups: {},
  Tags: {},
  Users: {},
}));

const express = require('express');
const request = require('../../helpers/local-request.js');

const config = require('../../../packages/server/node.config.js');
const {
  Galleries,
  Mailings,
  Templates,
  Workspaces,
  Folders,
} = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';
const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const USER_ID = '507f1f77bcf86cd799439101';
const WORKSPACE_ID = '507f1f77bcf86cd799439d01';
const FOLDER_ID = '507f1f77bcf86cd799439e01';
const PARENT_ID = '507f1f77bcf86cd799439055';
const IMAGE_NAME = `${PARENT_ID}-0123456789abcdef.png`;
const LABEL_URL = `/api/images/gallery/${PARENT_ID}/${IMAGE_NAME}/label`;

const userOfRole = (role) => ({
  id: USER_ID,
  role,
  group: { id: role === ROLES.SUPER_ADMIN ? PLATFORM_GROUP : GROUP },
});
const bootstrapAccount = { id: config.admin.id, name: 'admin' };

let router;
beforeAll(() => {
  router = require('../../../packages/server/image/image.routes.js');
});

function renameAs(user) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.user = user;
    next();
  });
  server.use('/api/images', router);
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return request(server).patch(LABEL_URL).send({ label: 'Renamed' });
}

const findIn = (documents) => (query) =>
  Promise.resolve(
    documents.find(
      (doc) =>
        String(doc._id) === String(query._id) &&
        (!query._company || String(doc._company) === String(query._company))
    ) || null
  );

const populated = (value) => ({ populate: () => Promise.resolve(value) });

// The email's workspace, in `group`, with or without the user as a member.
function workspaceOf(group, member) {
  const workspace = {
    _id: WORKSPACE_ID,
    _company: group,
    _users: member ? [USER_ID] : [],
  };
  Workspaces.exists.mockResolvedValue(true);
  Workspaces.findById.mockReturnValue(populated(workspace));
  Folders.exists.mockResolvedValue(true);
  Folders.findOne.mockReturnValue(
    populated({ _id: FOLDER_ID, _workspace: WORKSPACE_ID })
  );
}

function parentIs(parent) {
  Mailings.findOne.mockImplementation(
    findIn(parent.collection === 'mailing' ? [parent] : [])
  );
  Templates.findOne.mockImplementation(
    findIn(parent.collection === 'template' ? [parent] : [])
  );
}

// An email of `group`, in a workspace or in a folder of that workspace.
function emailIn(group, { member, inFolder }) {
  workspaceOf(group, member);
  parentIs({
    collection: 'mailing',
    _id: PARENT_ID,
    _company: group,
    ...(inFolder ? { _parentFolder: FOLDER_ID } : { _workspace: WORKSPACE_ID }),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  Galleries.findOneAndUpdate.mockResolvedValue({
    files: [{ name: IMAGE_NAME, label: 'Renamed' }],
  });
});

async function expectAnswer(user, status) {
  const res = await renameAs(user);
  expect(res.status).toBe(status);
  if (status === 403) {
    expect(res.body.message).toBe(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
    expect(Galleries.findOneAndUpdate).not.toHaveBeenCalled();
  } else {
    expect(Galleries.findOneAndUpdate).toHaveBeenCalled();
  }
}

// Expected answer for each role: [member of the email's workspace, not a
// member of it, email of another group].
const EMAIL_RIGHTS = [
  [ROLES.SUPER_ADMIN, 200, 200, 200],
  [ROLES.GROUP_ADMIN_TECH, 200, 200, 403],
  [ROLES.GROUP_ADMIN, 200, 200, 403],
  [ROLES.REGULAR_USER, 200, 403, 403],
  [ROLES.WRITER, 200, 403, 403],
  [ROLES.REVIEWER, 200, 403, 403],
];

// One column of a rights table: [role, expected status] for each role.
const column = (table, index) => table.map((row) => [row[0], row[index]]);

describe.each([
  ['in a workspace', false],
  ['in a folder', true],
])('renaming a label in the gallery of an email %s', (_where, inFolder) => {
  it.each(column(EMAIL_RIGHTS, 1))(
    '%s: %i as a member of the workspace',
    async (role, status) => {
      emailIn(GROUP, { member: true, inFolder });
      await expectAnswer(userOfRole(role), status);
    }
  );

  it.each(column(EMAIL_RIGHTS, 2))(
    '%s: %i outside the workspace',
    async (role, status) => {
      emailIn(GROUP, { member: false, inFolder });
      await expectAnswer(userOfRole(role), status);
    }
  );

  it.each(column(EMAIL_RIGHTS, 3))(
    '%s: %i in another group',
    async (role, status) => {
      emailIn(OTHER_GROUP, { member: true, inFolder });
      await expectAnswer(userOfRole(role), status);
    }
  );
});

// Expected answer for each role: [template of its group, of another group].
const TEMPLATE_RIGHTS = [
  [ROLES.SUPER_ADMIN, 200, 200],
  [ROLES.GROUP_ADMIN_TECH, 403, 403],
  [ROLES.GROUP_ADMIN, 403, 403],
  [ROLES.REGULAR_USER, 403, 403],
  [ROLES.WRITER, 403, 403],
  [ROLES.REVIEWER, 403, 403],
];

describe('renaming a label in the gallery of a template', () => {
  const templateOf = (group) =>
    parentIs({ collection: 'template', _id: PARENT_ID, _company: group });

  it.each(column(TEMPLATE_RIGHTS, 1))(
    '%s: %i in its group',
    async (role, status) => {
      templateOf(GROUP);
      await expectAnswer(userOfRole(role), status);
    }
  );

  it.each(column(TEMPLATE_RIGHTS, 2))(
    '%s: %i in another group',
    async (role, status) => {
      templateOf(OTHER_GROUP);
      await expectAnswer(userOfRole(role), status);
    }
  );
});

describe('the scope of the rename', () => {
  it("reads the parent in the user's group only", async () => {
    emailIn(GROUP, { member: true });

    await renameAs(userOfRole(ROLES.REGULAR_USER));

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: PARENT_ID, _company: GROUP },
      expect.anything()
    );
  });

  // The same answer as a parent of another group: the code does not tell what
  // exists elsewhere.
  it('answers a parent that does not exist like one of another group', async () => {
    parentIs({ collection: 'none' });

    await expectAnswer(userOfRole(ROLES.REGULAR_USER), 403);
  });

  // The bootstrap account saves an email and edits a template like a super
  // admin; the rename follows the same rules.
  it('lets the bootstrap account rename in an email and in a template', async () => {
    emailIn(OTHER_GROUP, { member: false });
    await expectAnswer(bootstrapAccount, 200);

    parentIs({ collection: 'template', _id: PARENT_ID, _company: GROUP });
    await expectAnswer(bootstrapAccount, 200);
  });
});
