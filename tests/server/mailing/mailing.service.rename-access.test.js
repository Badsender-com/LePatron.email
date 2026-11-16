'use strict';

// Renaming a mailing writes in the mailing: it is read in the user's company
// (another company's answers like one that does not exist), then renamed only
// by whoever may save it, in the workspace or the folder that holds it. The
// location the request names is not what decides.
//
// The real workspace and folder services run; the models answer like MongoDB
// would: findOne honours `_id` and `_company`.

jest.mock('../../../packages/server/common/models.common', () => ({
  Mailings: { findOne: jest.fn(), updateOne: jest.fn() },
  Workspaces: { exists: jest.fn(), findById: jest.fn() },
  Folders: { exists: jest.fn(), findOne: jest.fn() },
  Galleries: {},
  Groups: {},
  Tags: {},
  Users: {},
  Templates: {},
}));
jest.mock('../../../packages/server/template/template.service.js', () => ({}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Workspaces,
  Folders,
} = require('../../../packages/server/common/models.common');
const mailingService = require('../../../packages/server/mailing/mailing.service');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';
const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const USER_ID = '507f1f77bcf86cd799439101';
const MAILING_ID = '507f1f77bcf86cd799439041';
const WORKSPACE_ID = '507f1f77bcf86cd799439d01';
const MY_WORKSPACE_ID = '507f1f77bcf86cd799439d02';
const FOLDER_ID = '507f1f77bcf86cd799439e01';

const userOfRole = (role) => ({
  id: USER_ID,
  role,
  group: { id: role === ROLES.SUPER_ADMIN ? PLATFORM_GROUP : GROUP },
});

const populated = (value) => ({ populate: () => Promise.resolve(value) });

// The mailing's workspace, of `group`, with or without the user as a member;
// and a workspace of the user's own, which the request may name instead.
function mailingIn(group, { member, inFolder }) {
  const workspaces = {
    [WORKSPACE_ID]: {
      _id: WORKSPACE_ID,
      _company: group,
      group,
      _users: member ? [USER_ID] : [],
    },
    [MY_WORKSPACE_ID]: {
      _id: MY_WORKSPACE_ID,
      _company: GROUP,
      group: GROUP,
      _users: [USER_ID],
    },
  };
  Workspaces.exists.mockResolvedValue(true);
  Workspaces.findById.mockImplementation((id) =>
    populated(workspaces[String(id)])
  );
  Folders.exists.mockResolvedValue(true);
  Folders.findOne.mockReturnValue(
    populated({ _id: FOLDER_ID, _workspace: WORKSPACE_ID })
  );
  const mailing = {
    _id: MAILING_ID,
    _company: group,
    ...(inFolder ? { _parentFolder: FOLDER_ID } : { _workspace: WORKSPACE_ID }),
  };
  Mailings.findOne.mockImplementation((query) =>
    Promise.resolve(
      String(query._id) === MAILING_ID &&
        (!query._company || String(query._company) === group)
        ? mailing
        : null
    )
  );
}

const rename = (user, where = { workspaceId: MY_WORKSPACE_ID }) =>
  mailingService.renameMailing(
    { mailingId: MAILING_ID, mailingName: 'Renamed', ...where },
    user
  );

// A refusal inside the company is the single save's: 403 for a workspace,
// 404 for a folder (folderService.hasAccess).
const REFUSED = 'refused';

async function expectAnswer(user, status) {
  const result = await rename(user).then(
    () => 204,
    (error) => error.status
  );
  if (status === REFUSED) {
    expect([403, 404]).toContain(result);
  } else {
    expect(result).toBe(status);
  }
  if (status === 204) {
    expect(Mailings.updateOne).toHaveBeenCalledWith(
      { _id: MAILING_ID },
      { name: 'Renamed' }
    );
  } else {
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  }
}

beforeEach(() => {
  jest.clearAllMocks();
  Mailings.updateOne.mockResolvedValue({ ok: 1 });
});

// Expected answer for each role holding mailing.organize: [member of the
// mailing's workspace, not a member of it, mailing of another company].
const RIGHTS = [
  [ROLES.SUPER_ADMIN, 204, 204, 204],
  [ROLES.GROUP_ADMIN_TECH, 204, 204, 404],
  [ROLES.GROUP_ADMIN, 204, 204, 404],
  [ROLES.REGULAR_USER, 204, REFUSED, 404],
  [ROLES.WRITER, 204, REFUSED, 404],
];
const column = (index) => RIGHTS.map((row) => [row[0], row[index]]);

describe.each([
  ['in a workspace', false],
  ['in a folder', true],
])('renaming a mailing %s', (_where, inFolder) => {
  it.each(column(1))(
    '%s: %s as a member of its workspace',
    async (role, status) => {
      mailingIn(GROUP, { member: true, inFolder });
      await expectAnswer(userOfRole(role), status);
    }
  );

  it.each(column(2))('%s: %s outside its workspace', async (role, status) => {
    mailingIn(GROUP, { member: false, inFolder });
    await expectAnswer(userOfRole(role), status);
  });

  it.each(column(3))('%s: %s in another company', async (role, status) => {
    mailingIn(OTHER_GROUP, { member: true, inFolder });
    await expectAnswer(userOfRole(role), status);
  });
});

describe('the request of a rename', () => {
  it('answers a mailing of another company like one that does not exist', async () => {
    mailingIn(OTHER_GROUP, { member: true });

    await expect(rename(userOfRole(ROLES.REGULAR_USER))).rejects.toMatchObject({
      status: 404,
      message: ERROR_CODES.MAILING_NOT_FOUND,
    });
  });

  it('needs no location: the mailing has its own', async () => {
    mailingIn(GROUP, { member: true });

    await expect(rename(userOfRole(ROLES.WRITER), {})).resolves.toBeUndefined();
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['an object', { $ne: null }],
  ])('refuses a name %s', async (_case, mailingName) => {
    mailingIn(GROUP, { member: true });

    await expect(
      mailingService.renameMailing(
        { mailingId: MAILING_ID, mailingName },
        userOfRole(ROLES.REGULAR_USER)
      )
    ).rejects.toMatchObject({
      status: 400,
      message: ERROR_CODES.NAME_NOT_PROVIDED,
    });
    expect(Mailings.updateOne).not.toHaveBeenCalled();
  });
});
