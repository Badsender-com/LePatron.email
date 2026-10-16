'use strict';

// The gallery routes as the editor calls them: the real router, guards,
// controller and service, over models that answer like MongoDB would. What
// is pinned here is what a client sees — the status and the error code — for
// the requests the gallery API accepts or refuses.

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

const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');

const GALLERY_ID = '507f1f77bcf86cd799439055';
const IMAGE_NAME = `${GALLERY_ID}-0123456789abcdef.png`;
const GROUP = '507f1f77bcf86cd799439b01';

const someone = { id: '507f1f77bcf86cd799439101', role: 'regular_user' };
const inGroup = (user) => ({ ...user, group: { id: GROUP } });

let router;
beforeAll(() => {
  // required here, once the stand-ins above are in place
  router = require('../../../packages/server/image/image.routes.js');
});

function app(user = inGroup(someone)) {
  const server = express();
  server.use(express.json());
  server.use((req, _res, next) => {
    req.user = user;
    next();
  });
  server.use('/api/images', router);
  // the shape config/error-handler and index.js give a client
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

// A mailing of GROUP owns the gallery; findOne honours `_id` and `_company`
// the way the database would.
function parentMailingIn(group) {
  const owner = { _id: GALLERY_ID, _company: group };
  Mailings.findOne.mockImplementation((query) =>
    Promise.resolve(
      String(query._id) === owner._id &&
        (!query._company || String(query._company) === owner._company)
        ? owner
        : null
    )
  );
  Templates.findOne.mockResolvedValue(null);
}

beforeEach(() => {
  jest.clearAllMocks();
  parentMailingIn(GROUP);
  Galleries.findOne.mockResolvedValue({ files: [] });
  Galleries.findOneAndUpdate.mockImplementation((_query, update) =>
    Promise.resolve({
      files: [{ name: IMAGE_NAME, label: update.$set['files.$.label'] }],
    })
  );
});

describe('a gallery id that is not an ObjectId', () => {
  it.each([
    ['get', '/api/images/gallery/not-an-id'],
    ['get', '/api/images/gallery/undefined'],
    ['post', '/api/images/gallery/not-an-id'],
    ['post', '/api/images/gallery/not-an-id/from-url'],
    ['patch', '/api/images/gallery/not-an-id/not-an-id-x.png/label'],
  ])(
    '%s %s is a bad request, refused before any query',
    async (method, url) => {
      const res = await request(app())[method](url).send({ label: 'x' });

      expect(res.status).toBe(400);
      expect(res.body.message).toBe(ERROR_CODES.INVALID_OBJECT_ID);
      expect(Galleries.findOne).not.toHaveBeenCalled();
      expect(Mailings.findOne).not.toHaveBeenCalled();
    }
  );
});
