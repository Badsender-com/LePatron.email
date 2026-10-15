'use strict';

// Head CSS is stored on the mailing, next to `previewHtml` and `data`, and like
// them it is only read by the editor (findOneForMosaico). The list payloads
// built with exclusion projections would otherwise carry up to 20 000
// characters per row, for a table that never shows them.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: { find: jest.fn(), countDocuments: jest.fn() },
  Groups: { findById: jest.fn() },
  Users: { findById: jest.fn() },
  Profiles: {},
  Templates: {},
}));
jest.mock('../../../packages/server/group/group.service.js', () => ({}));
jest.mock('../../../packages/server/user/user.service.js', () => ({}));
jest.mock('../../../packages/server/profile/profile.service.js', () => ({}));
jest.mock(
  '../../../packages/server/emails-group/emails-group.service.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/personalized-variables/personalized-variable.service.js',
  () => ({})
);
jest.mock('../../../packages/server/group/group-ftp.service.js', () => ({}));
jest.mock(
  '../../../packages/server/workspace/workspace.service.js',
  () => ({})
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  Mailings,
  Groups,
  Users,
} = require('../../../packages/server/common/models.common.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');
const groupController = require('../../../packages/server/group/group.controller.js');
const userController = require('../../../packages/server/user/user.controller.js');
const {
  HEAD_CSS_MAX_LENGTH,
} = require('../../../packages/shared/head-css/constants.js');
const {
  MAILING_LIST_PROJECTION,
} = require('../../../packages/server/constant/mailing-list-projection.js');

const ID = '507f1f77bcf86cd799439001';

// A chainable stand-in for the Mongoose query: records the `select` argument.
function mockMailingsQuery() {
  const query = {
    select: jest.fn(() => query),
    sort: jest.fn(() => query),
    skip: jest.fn(() => query),
    limit: jest.fn(() => Promise.resolve([])),
  };
  Mailings.find.mockReturnValue(query);
  Mailings.countDocuments.mockResolvedValue(0);
  return query;
}

const byId = () => ({ select: () => Promise.resolve({ _id: ID }) });

function call(handler, req) {
  return new Promise((resolve, reject) => {
    handler(req, { json: resolve }, reject);
  });
}

beforeEach(() => jest.clearAllMocks());

describe('list payloads leave the head CSS out', () => {
  it('findForApi', async () => {
    const model = { find: jest.fn() };

    await MailingSchema.statics.findForApi.call(model, {});

    expect(model.find.mock.calls[0][1]).toMatchObject({ headCss: 0 });
  });

  it('GET /groups/:groupId/mailings', async () => {
    const query = mockMailingsQuery();
    Groups.findById.mockReturnValue(byId());

    await call(groupController.readMailings, {
      params: { groupId: ID },
      query: {},
    });

    expect(query.select.mock.calls[0][0]).toMatchObject({ headCss: 0 });
  });

  it('GET /users/:userId/mailings', async () => {
    const query = mockMailingsQuery();
    Users.findById.mockReturnValue(byId());

    await call(userController.readMailings, {
      params: { userId: ID },
      query: {},
    });

    expect(query.select.mock.calls[0][0]).toMatchObject({ headCss: 0 });
  });
});

// The route refuses an oversized stylesheet first, with its own code; the
// schema bound is for any write that does not go through it.
// One projection for every list, so a heavy field added to it reaches all of
// them at once.
describe('the list projection', () => {
  it('leaves out every field only the editor reads', () => {
    expect(MAILING_LIST_PROJECTION).toEqual({
      previewHtml: 0,
      data: 0,
      headCss: 0,
      qualityIgnores: 0,
    });
  });
});

describe('the schema bound', () => {
  it('matches the shared limit', () => {
    expect(MailingSchema.path('headCss').options.maxlength).toBe(
      HEAD_CSS_MAX_LENGTH
    );
  });
});
