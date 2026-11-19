'use strict';

// Who may change the tags of several mailings at once (PUT /mailings), for
// every role. The capability is mailing.organize; the scope, the single
// save's: the workspace holding each mailing, or the workspace of its folder.
// The real mailing, workspace and folder services run; the models answer like
// MongoDB would.

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {
    find: jest.fn(),
    addTagsToEmail: jest.fn(),
    removeTagsFromEmail: jest.fn(),
    findForApi: jest.fn(),
    findTags: jest.fn(),
  },
  Workspaces: { exists: jest.fn(), findById: jest.fn() },
  Folders: { exists: jest.fn(), findOne: jest.fn() },
  Templates: {},
  Galleries: {},
  Groups: {},
  Tags: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/send-test-mail.controller.js', () =>
  jest.fn()
);
jest.mock(
  '../../../packages/server/mailing/download-zip.controller.js',
  () => ({ downloadZip: jest.fn(), downloadMultipleZip: jest.fn() })
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Workspaces,
  Folders,
} = require('../../../packages/server/common/models.common.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');
const router = require('../../../packages/server/mailing/mailing.routes.js');
const { GUARD_CAN } = require('../../../packages/server/account/auth.guard.js');
const {
  ROLES,
  CAPABILITIES,
  capabilitiesOfRole,
} = require('../../../packages/shared/access/roles.js');
const { routeInspector } = require('../../helpers/express-router.js');

const GROUP = '507f1f77bcf86cd799439b01';
const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const USER_ID = '507f1f77bcf86cd799439101';
const MAILING_ID = '507f1f77bcf86cd799439041';
const WORKSPACE_ID = '507f1f77bcf86cd799439d01';
const FOLDER_ID = '507f1f77bcf86cd799439e01';

// A super admin lists the mailings of its selected group.
const userOfRole = (role) =>
  role === ROLES.SUPER_ADMIN
    ? {
        id: USER_ID,
        role,
        group: { id: PLATFORM_GROUP },
        selectedGroup: { id: GROUP },
      }
    : { id: USER_ID, role, group: { id: GROUP } };

const populated = (value) => ({ populate: () => Promise.resolve(value) });

function mailingIn({ member, inFolder }) {
  Workspaces.exists.mockResolvedValue(true);
  Workspaces.findById.mockReturnValue(
    populated({
      _id: WORKSPACE_ID,
      _company: GROUP,
      group: GROUP,
      _users: member ? [USER_ID] : [],
    })
  );
  Folders.exists.mockResolvedValue(true);
  Folders.findOne.mockReturnValue(
    populated({ _id: FOLDER_ID, _workspace: WORKSPACE_ID })
  );
  const mailing = {
    _id: MAILING_ID,
    tags: ['old'],
    save: jest.fn().mockResolvedValue(undefined),
    ...(inFolder ? { _parentFolder: FOLDER_ID } : { _workspace: WORKSPACE_ID }),
  };
  // findOne-like: only the mailings of the listing group are found.
  Mailings.find.mockImplementation((query) => ({
    select: () =>
      Promise.resolve(String(query._company) === GROUP ? [mailing] : []),
  }));
}

function bulkUpdate(user) {
  return new Promise((resolve) => {
    const res = { json: () => resolve(200) };
    controller.bulkUpdate(
      {
        user,
        body: {
          items: [MAILING_ID],
          tags: { added: ['launch'], removed: [] },
        },
      },
      res,
      (err) => resolve(err.status)
    );
  });
}

const Tag = { find: jest.fn(), insertMany: jest.fn() };

beforeAll(() => {
  mongoose.models.Tag = Tag;
});

afterAll(() => {
  delete mongoose.models.Tag;
});

beforeEach(() => {
  jest.clearAllMocks();
  Tag.find.mockReturnValue({ lean: () => Promise.resolve([]) });
  Mailings.findForApi.mockResolvedValue([]);
  Mailings.findTags.mockResolvedValue([]);
});

// The reviewer holds no mailing.organize: the route refuses it first.
it('asks mailing.organize, which the reviewer does not hold', () => {
  const { guardsOf } = routeInspector(router);

  expect(guardsOf('put', '')).toEqual([
    GUARD_CAN(CAPABILITIES.MAILING_ORGANIZE),
  ]);
  expect(capabilitiesOfRole(ROLES.REVIEWER)).not.toContain(
    CAPABILITIES.MAILING_ORGANIZE
  );
});

// Expected answer for each role holding mailing.organize: [member of the
// mailing's workspace, not a member of it].
const RIGHTS = [
  [ROLES.SUPER_ADMIN, 200, 200],
  [ROLES.GROUP_ADMIN_TECH, 200, 200],
  [ROLES.GROUP_ADMIN, 200, 200],
  [ROLES.REGULAR_USER, 200, 'refused'],
  [ROLES.WRITER, 200, 'refused'],
];

async function expectAnswer(role, expected) {
  const status = await bulkUpdate(userOfRole(role));
  if (expected === 'refused') {
    // the single save's refusals: 403 for a workspace, 404 for a folder
    expect([403, 404]).toContain(status);
    expect(Mailings.addTagsToEmail).not.toHaveBeenCalled();
  } else {
    expect(status).toBe(expected);
    expect(Mailings.addTagsToEmail).toHaveBeenCalledWith(MAILING_ID, [
      'launch',
    ]);
  }
}

describe.each([
  ['in a workspace', false],
  ['in a folder', true],
])('tagging a mailing %s', (_where, inFolder) => {
  it.each(RIGHTS.map((row) => [row[0], row[1]]))(
    '%s: %s as a member of its workspace',
    async (role, expected) => {
      mailingIn({ member: true, inFolder });
      await expectAnswer(role, expected);
    }
  );

  it.each(RIGHTS.map((row) => [row[0], row[2]]))(
    '%s: %s outside its workspace',
    async (role, expected) => {
      mailingIn({ member: false, inFolder });
      await expectAnswer(role, expected);
    }
  );
});
