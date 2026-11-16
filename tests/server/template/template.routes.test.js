'use strict';

// The template routes as a client calls them: the real router, guards and
// controllers, over a Templates model that filters like MongoDB would. A
// `:templateId` that is not an ObjectId is a bad request on every route,
// refused before any controller. One template reads within the caller's
// company, any company's for a super admin; another company's reads as not
// found.

jest.mock('puppeteer', () => ({}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findOne: jest.fn(), findById: jest.fn() },
  Groups: { findById: jest.fn() },
  Mailings: { find: jest.fn() },
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  parseMultipart: jest.fn(),
}));
jest.mock(
  '../../../packages/server/template/generate-preview.controller.js',
  () => {
    const answer = (req, res) => res.json({});
    return {
      previewMarkup: jest.fn(answer),
      generatePreviews: jest.fn(answer),
      previewEvents: jest.fn(answer),
    };
  }
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('../../helpers/local-request.js');

const {
  Templates,
  Groups,
  Mailings,
} = require('../../../packages/server/common/models.common.js');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const previews = require('../../../packages/server/template/generate-preview.controller.js');
const ERROR_CODES = require('../../../packages/server/constant/error-codes.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const { actorFrom } = require('../../helpers/super-admin-fixtures.js');

const OWN_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439b02';
const OWN_TEMPLATE = '507f1f77bcf86cd799439c01';
const OTHER_TEMPLATE = '507f1f77bcf86cd799439c02';
const MISSING_TEMPLATE = '507f1f77bcf86cd799439c03';

const STORED_TEMPLATES = [
  {
    _id: OWN_TEMPLATE,
    name: 'Own newsletter',
    _company: OWN_GROUP,
    markup: '<html>own</html>',
  },
  {
    _id: OTHER_TEMPLATE,
    name: 'Other digest',
    _company: OTHER_GROUP,
    markup: '<html>other</html>',
  },
];

// `findOne` matches `_id` and, when the filter has one, `_company`; what it
// returns is awaited directly or after `populate`, as Mongoose allows.
function storedTemplate(filter) {
  return (
    STORED_TEMPLATES.find(
      (template) =>
        template._id === String(filter._id) &&
        (filter._company === undefined ||
          template._company === String(filter._company))
    ) || null
  );
}
function fakeQuery(doc) {
  const result = Promise.resolve(doc);
  return { populate: () => result, then: result.then.bind(result) };
}

const userWith = (role) =>
  actorFrom({
    _id: '507f1f77bcf86cd799439101',
    name: 'Someone',
    role,
    _company: OWN_GROUP,
  });
const superAdmin = userWith(ROLES.SUPER_ADMIN);

let router;
beforeAll(() => {
  // required here, once the stand-ins above are in place
  router = require('../../../packages/server/template/template.routes.js');
});

function app(user) {
  const server = express();
  server.use((req, _res, next) => {
    req.user = user;
    next();
  });
  server.use('/api/templates', router);
  // the shape index.js gives a client
  server.use((err, _req, res, _next) => {
    res.status(err.status || 500).json({ message: err.message });
  });
  return server;
}

beforeEach(() => {
  jest.clearAllMocks();
  Templates.findOne.mockImplementation((filter) =>
    fakeQuery(storedTemplate(filter))
  );
  Groups.findById.mockReturnValue({
    select: () => ({ lean: () => Promise.resolve({ _id: OWN_GROUP }) }),
  });
});

describe('a template id that is not an ObjectId', () => {
  // Every route of the router that takes the id, read off the router itself
  // so that a route added later is covered too.
  const routesWithId = () =>
    router.stack
      .filter((layer) => layer.route?.path.includes(':templateId'))
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map((method) => [
          method,
          layer.route.path,
        ])
      );

  it('covers every route that takes one', () => {
    expect(routesWithId()).toHaveLength(10);
  });

  it.each(['undefined', 'not-an-id', `${OWN_TEMPLATE}x`])(
    'answers a bad request on every route for %s, before any query',
    async (badId) => {
      for (const [method, path] of routesWithId()) {
        const url = `/api/templates${path.replace(':templateId', badId)}`;
        const res = await request(app(superAdmin))[method](url);

        expect([method, path, res.status]).toEqual([method, path, 400]);
        expect(res.body.message).toBe(ERROR_CODES.INVALID_OBJECT_ID);
      }
      expect(Templates.findOne).not.toHaveBeenCalled();
      expect(Templates.findById).not.toHaveBeenCalled();
      expect(Mailings.find).not.toHaveBeenCalled();
      expect(fileManager.parseMultipart).not.toHaveBeenCalled();
      expect(previews.previewMarkup).not.toHaveBeenCalled();
      expect(previews.generatePreviews).not.toHaveBeenCalled();
      expect(previews.previewEvents).not.toHaveBeenCalled();
    }
  );

  it('lets an ObjectId through to the controller', async () => {
    const res = await request(app(superAdmin)).get(
      `/api/templates/${OWN_TEMPLATE}/preview`
    );

    expect(res.status).toBe(200);
    expect(previews.previewMarkup).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/templates/:templateId', () => {
  const read = (user, templateId) =>
    request(app(user)).get(`/api/templates/${templateId}`);

  it.each(Object.values(ROLES))(
    "gives a %s their own company's template",
    async (role) => {
      const res = await read(userWith(role), OWN_TEMPLATE);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Own newsletter');
    }
  );

  it.each([
    [ROLES.SUPER_ADMIN, 200],
    [ROLES.GROUP_ADMIN_TECH, 404],
    [ROLES.GROUP_ADMIN, 404],
    [ROLES.REGULAR_USER, 404],
    [ROLES.WRITER, 404],
    [ROLES.REVIEWER, 404],
  ])(
    "answers a %s with %i for another company's template",
    async (role, status) => {
      const res = await read(userWith(role), OTHER_TEMPLATE);

      expect(res.status).toBe(status);
      if (status === 404) {
        expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
      }
    }
  );

  it('answers not found for a template that does not exist', async () => {
    const res = await read(superAdmin, MISSING_TEMPLATE);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
  });
});
