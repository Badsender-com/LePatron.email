'use strict';

// Who may rename the label of a gallery image (ADR 0004: every role may use
// the image gallery). Two checks answer it, and both are played here through
// the real route: the capability (gallery.manage, held by every role) and the
// scope. A gallery carries no company of its own: the mailing or template it
// belongs to does, so the parent must be in the user's group, unless the user
// has every right in every group.
//
// The models answer like MongoDB would: findOne honours `_id` and `_company`.

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
  Users: {},
  OAuthClients: {},
  OAuthTokens: {},
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
}));

const express = require('express');
const request = require('supertest');

const config = require('../../../packages/server/node.config.js');
const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');

const GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439c01';
const PLATFORM_GROUP = '507f1f77bcf86cd799439a01';
const PARENT_ID = '507f1f77bcf86cd799439055';
const IMAGE_NAME = `${PARENT_ID}-0123456789abcdef.png`;
const LABEL_URL = `/api/images/gallery/${PARENT_ID}/${IMAGE_NAME}/label`;

const userOfRole = (role, group) => ({
  id: '507f1f77bcf86cd799439101',
  role,
  group: { id: role === ROLES.SUPER_ADMIN ? PLATFORM_GROUP : group },
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

function parentIs(collection, group) {
  const parents = [{ _id: PARENT_ID, _company: group }];
  Mailings.findOne.mockImplementation(
    findIn(collection === 'mailing' ? parents : [])
  );
  Templates.findOne.mockImplementation(
    findIn(collection === 'template' ? parents : [])
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  Galleries.findOneAndUpdate.mockResolvedValue({
    files: [{ name: IMAGE_NAME, label: 'Renamed' }],
  });
});

// Expected answer for each role: [own group, another group].
const RIGHTS = [
  [ROLES.SUPER_ADMIN, 200, 200],
  [ROLES.GROUP_ADMIN_TECH, 200, 403],
  [ROLES.GROUP_ADMIN, 200, 403],
  [ROLES.REGULAR_USER, 200, 403],
  [ROLES.WRITER, 200, 403],
  [ROLES.REVIEWER, 200, 403],
];

describe.each(['mailing', 'template'])(
  'renaming a label in the gallery of a %s',
  (collection) => {
    it.each(RIGHTS)('%s: %i in its group', async (role, ownGroup) => {
      parentIs(collection, GROUP);

      const res = await renameAs(userOfRole(role, GROUP));

      expect(res.status).toBe(ownGroup);
      expect(Galleries.findOneAndUpdate).toHaveBeenCalled();
    });

    it.each(RIGHTS)(
      '%s: %i in another group',
      async (role, _ownGroup, otherGroup) => {
        parentIs(collection, OTHER_GROUP);

        const res = await renameAs(userOfRole(role, GROUP));

        expect(res.status).toBe(otherGroup);
        if (otherGroup === 403) {
          expect(res.body.message).toBe(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
          expect(Galleries.findOneAndUpdate).not.toHaveBeenCalled();
        }
      }
    );
  }
);

describe('the scope of the rename', () => {
  it("reads the parent in the user's group only", async () => {
    parentIs('mailing', GROUP);

    await renameAs(userOfRole(ROLES.REGULAR_USER, GROUP));

    expect(Mailings.findOne).toHaveBeenCalledWith(
      { _id: PARENT_ID, _company: GROUP },
      '_id'
    );
  });

  // The same answer as a parent of another group: the code does not tell what
  // exists elsewhere.
  it('answers a parent that does not exist like one of another group', async () => {
    parentIs('mailing', GROUP);
    Mailings.findOne.mockResolvedValue(null);

    const res = await renameAs(userOfRole(ROLES.REGULAR_USER, GROUP));

    expect(res.status).toBe(403);
    expect(res.body.message).toBe(ERROR_CODES.FORBIDDEN_GALLERY_ACCESS);
  });

  // The bootstrap account opens the editor and saves an email in it like a
  // super admin; uploading and removing a gallery image let it in too. The
  // rename follows the gallery it belongs to.
  it('lets the bootstrap account rename, like the other gallery writes', async () => {
    parentIs('mailing', OTHER_GROUP);

    const res = await renameAs(bootstrapAccount);

    expect(res.status).toBe(200);
  });
});
