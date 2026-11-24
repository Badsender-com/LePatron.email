'use strict';

// The template routes as a client calls them: the real router, guards and
// controllers, over a Templates model that filters like MongoDB would. A
// `:templateId` that is not an ObjectId is a bad request on every route,
// refused before any controller. One template is read by a super admin only,
// from any company. The markup is read by every role within its own company,
// the block list by its technical admins; another company's template reads as
// not found.

jest.mock('puppeteer', () => ({}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findOne: jest.fn(), findById: jest.fn() },
  Groups: { findById: jest.fn() },
  Mailings: { find: jest.fn() },
  Galleries: {},
  Users: {},
}));
// The template's contract (ADR-0024) is read from the stored markup; these
// tests are about who reads which template, not what its contract says.
jest.mock(
  '../../../packages/server/template/template-contract.service.js',
  () => ({
    contractOfTemplate: jest.fn(() =>
      Promise.resolve({ declared: {}, read: [], adopt: {} })
    ),
    listContracts: jest.fn(() => Promise.resolve([])),
  })
);
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
const {
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

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
    // The adoption routes (ADR-0024) among them.
    expect(routesWithId()).toHaveLength(13);
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

  // Only the super admin's template page reads one template with its
  // settings: any company's for a super admin and the bootstrap account.
  it.each([
    ['a super admin', superAdmin],
    ['the bootstrap account', bootstrap],
  ])("gives %s any company's template", async (_label, user) => {
    for (const [templateId, name] of [
      [OWN_TEMPLATE, 'Own newsletter'],
      [OTHER_TEMPLATE, 'Other digest'],
    ]) {
      const res = await read(user, templateId);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe(name);
    }
  });

  it.each(Object.values(ROLES).filter((role) => role !== ROLES.SUPER_ADMIN))(
    'refuses a %s, whichever company the template belongs to',
    async (role) => {
      for (const templateId of [OWN_TEMPLATE, OTHER_TEMPLATE]) {
        expect((await read(userWith(role), templateId)).status).toBe(401);
      }
      expect(Templates.findOne).not.toHaveBeenCalled();
    }
  );

  it('answers not found for a template that does not exist', async () => {
    const res = await read(superAdmin, MISSING_TEMPLATE);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
  });
});

// The markup is read by every role, within its own company.
describe('GET /api/templates/:templateId/markup', () => {
  const readMarkup = (user, templateId) =>
    request(app(user)).get(`/api/templates/${templateId}/markup`);

  it.each(Object.values(ROLES))(
    "sends a %s the markup of their own company's template",
    async (role) => {
      const res = await readMarkup(userWith(role), OWN_TEMPLATE);

      expect(res.status).toBe(200);
      expect(res.text).toBe('<html>own</html>');
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
      const res = await readMarkup(userWith(role), OTHER_TEMPLATE);

      expect(res.status).toBe(status);
      if (status === 404) {
        expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
      }
    }
  );

  it('answers not found for a template that does not exist', async () => {
    const res = await readMarkup(superAdmin, MISSING_TEMPLATE);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
  });
});

// The block list serves the feed-mapping settings: technical admins of the
// company, and super admins.
describe('GET /api/templates/:templateId/blocks-with-fields', () => {
  const listBlocks = (user, templateId) =>
    request(app(user)).get(`/api/templates/${templateId}/blocks-with-fields`);

  it.each([
    [ROLES.SUPER_ADMIN, 200, 200],
    [ROLES.GROUP_ADMIN_TECH, 200, 404],
    [ROLES.GROUP_ADMIN, 401, 401],
    [ROLES.REGULAR_USER, 401, 401],
    [ROLES.WRITER, 401, 401],
    [ROLES.REVIEWER, 401, 401],
  ])(
    "answers a %s with %i for their own company's template, %i for another's",
    async (role, own, other) => {
      expect((await listBlocks(userWith(role), OWN_TEMPLATE)).status).toBe(own);
      const res = await listBlocks(userWith(role), OTHER_TEMPLATE);
      expect(res.status).toBe(other);
      if (other === 404) {
        expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
      }
    }
  );

  it('answers not found for a template that does not exist', async () => {
    const res = await listBlocks(superAdmin, MISSING_TEMPLATE);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe(ERROR_CODES.TEMPLATE_NOT_FOUND);
  });
});
