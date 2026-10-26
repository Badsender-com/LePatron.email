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
}));
// the email's write scope has its own test (image.routes.gallery-rights)
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  findOneForUser: jest.fn(),
  userCanEditMailing: jest.fn().mockResolvedValue(true),
}));

const express = require('express');
const request = require('../../helpers/local-request.js');

const {
  Galleries,
  Mailings,
  Templates,
} = require('../../../packages/server/common/models.common.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const {
  MAX_LABEL_LENGTH,
} = require('../../../packages/shared/gallery/label.js');

const GALLERY_ID = '507f1f77bcf86cd799439055';
const IMAGE_NAME = `${GALLERY_ID}-0123456789abcdef.png`;
const GROUP = '507f1f77bcf86cd799439b01';
const URL = `/api/images/gallery/${GALLERY_ID}`;
const LABEL_URL = `${URL}/${IMAGE_NAME}/label`;

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

describe('PATCH /gallery/:mongoId/:imageName/label — what it accepts', () => {
  const rename = (label) => request(app()).patch(LABEL_URL).send({ label });

  it('stores the cleaned label and answers with the renamed image', async () => {
    const res = await rename('  Mon\u202E image  ');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: IMAGE_NAME, label: 'Mon image' });
    expect(Galleries.findOneAndUpdate).toHaveBeenCalledWith(
      { creationOrWireframeId: GALLERY_ID, 'files.name': IMAGE_NAME },
      { $set: { 'files.$.label': 'Mon image' } },
      expect.anything()
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['made of spaces', '   '],
    ['made of control characters', '\u0000\u0007'],
    ['a number', 42],
    ['an array', ['label']],
    ['an object', { $ne: null }],
  ])('refuses a label %s', async (_case, label) => {
    const res = await rename(label);

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ERROR_CODES.LABEL_NOT_PROVIDED);
    expect(Galleries.findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('refuses a label longer than a label can be', async () => {
    const res = await rename('a'.repeat(MAX_LABEL_LENGTH + 1));

    expect(res.status).toBe(400);
    expect(res.body.message).toBe(ERROR_CODES.LABEL_TOO_LONG);
  });

  it('accepts a label of exactly the maximum length', async () => {
    const res = await rename('a'.repeat(MAX_LABEL_LENGTH));

    expect(res.status).toBe(200);
  });

  it('refuses an image name of another gallery, before reading anything', async () => {
    const otherImage = '507f1f77bcf86cd799439066-0123456789abcdef.png';
    const res = await request(app())
      .patch(`${URL}/${otherImage}/label`)
      .send({ label: 'x' });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe(ERROR_CODES.INVALID_IMAGE_NAME);
    expect(Mailings.findOne).not.toHaveBeenCalled();
  });

  it('tells a missing image apart from a missing gallery', async () => {
    Galleries.findOneAndUpdate.mockResolvedValue(null);
    Galleries.exists.mockResolvedValue({ _id: 'gallery' });

    const res = await rename('x');

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ERROR_CODES.GALLERY_IMAGE_NOT_FOUND);
  });
});

describe('GET /gallery/:mongoId — what it answers', () => {
  const FILES = [
    { name: `${GALLERY_ID}-a.png`, label: 'Logo.png' },
    { name: `${GALLERY_ID}-b.jpg`, label: 'Bannière.jpg' },
  ];

  beforeEach(() => {
    Galleries.findOne.mockResolvedValue({ files: FILES });
  });

  // the editor searches, filters and sorts the gallery itself
  it.each([
    ['no query', {}],
    ['a query it does not read', { search: 'logo', sortBy: 'name' }],
  ])('answers every image with %s', async (_case, query) => {
    const res = await request(app()).get(URL).query(query);

    expect(res.status).toBe(200);
    expect(res.body.files.map((f) => f.label)).toEqual([
      'Logo.png',
      'Bannière.jpg',
    ]);
  });
});
