'use strict';

// Changing the tags of several mailings at once (PUT /mailings): each mailing
// is written only when the user may save it, as for a single mailing (its
// workspace, or the workspace of its folder). One mailing it may not save
// refuses the whole request, before any tag or mailing is written.

const mongoose = require('mongoose');

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {
    find: jest.fn(),
    addTagsToEmail: jest.fn(),
    removeTagsFromEmail: jest.fn(),
    findForApi: jest.fn(),
    findTags: jest.fn(),
  },
  Templates: {},
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  assertUserCanEditMailing: jest.fn(),
}));
jest.mock(
  '../../../packages/server/mailing/send-test-mail.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/mailing/download-zip.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));

const { Forbidden } = require('http-errors');
const {
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const controller = require('../../../packages/server/mailing/mailing.controller.js');

const GROUP = '507f1f77bcf86cd799439b01';
const OWN = '507f1f77bcf86cd799439041';
const OTHER = '507f1f77bcf86cd799439042';
const user = {
  id: '507f1f77bcf86cd799439101',
  role: 'regular_user',
  group: { id: GROUP },
};

const mailingOf = (id, workspace) => ({
  _id: id,
  _workspace: workspace,
  tags: ['old'],
  save: jest.fn().mockResolvedValue(undefined),
});
const own = mailingOf(OWN, 'own-workspace');
const other = mailingOf(OTHER, 'other-workspace');

const Tag = { find: jest.fn(), insertMany: jest.fn() };
let select;

function bulkUpdate() {
  return new Promise((resolve) => {
    const res = { json: (body) => resolve({ status: 200, body }) };
    controller.bulkUpdate(
      {
        user,
        body: {
          items: [OWN, OTHER],
          tags: { added: ['launch'], removed: ['old'] },
        },
      },
      res,
      (err) => resolve({ status: err.status })
    );
  });
}

beforeAll(() => {
  mongoose.models.Tag = Tag;
});

afterAll(() => {
  delete mongoose.models.Tag;
});

beforeEach(() => {
  jest.clearAllMocks();
  Tag.find.mockReturnValue({ lean: () => Promise.resolve([]) });
  select = jest.fn().mockResolvedValue([own, other]);
  Mailings.find.mockReturnValue({ select });
  Mailings.findForApi.mockResolvedValue([]);
  Mailings.findTags.mockResolvedValue([]);
  mailingService.assertUserCanEditMailing.mockResolvedValue(undefined);
});

it('writes the tags of every mailing the user may save', async () => {
  const result = await bulkUpdate();

  expect(result.status).toBe(200);
  expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledWith(
    user,
    own
  );
  expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledWith(
    user,
    other
  );
  expect(Mailings.addTagsToEmail).toHaveBeenCalledTimes(2);
});

it("reads each mailing's location, in the user's company", async () => {
  await bulkUpdate();

  expect(Mailings.find.mock.calls[0][0]._company).toEqual(
    mongoose.Types.ObjectId(GROUP)
  );
  expect(select).toHaveBeenCalledWith(
    expect.objectContaining({ _workspace: 1, _parentFolder: 1 })
  );
});

it('writes nothing when one mailing may not be saved by the user', async () => {
  mailingService.assertUserCanEditMailing.mockImplementation(
    async (_user, mailing) => {
      if (mailing === other) throw new Forbidden();
    }
  );

  const result = await bulkUpdate();

  expect(result.status).toBe(403);
  expect(Tag.insertMany).not.toHaveBeenCalled();
  expect(Mailings.addTagsToEmail).not.toHaveBeenCalled();
  expect(Mailings.removeTagsFromEmail).not.toHaveBeenCalled();
  expect(own.save).not.toHaveBeenCalled();
});

it('asks once for mailings of the same location', async () => {
  const sibling = mailingOf(OTHER, 'own-workspace');
  select.mockResolvedValue([own, sibling]);

  await bulkUpdate();

  expect(mailingService.assertUserCanEditMailing).toHaveBeenCalledTimes(1);
  expect(Mailings.addTagsToEmail).toHaveBeenCalledTimes(2);
});
