'use strict';

// PUT /templates/:templateId/quality-settings as a client calls it: the real
// router, guards and controller, over models that apply the projection they
// are asked for, as MongoDB would (epic #1193, ADR 0009). A super admin
// overrides any template's settings, a company admin or tech admin the ones of
// their own company's templates; every other role is refused by the route's
// guard, before any template is read.

jest.mock('puppeteer', () => ({}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn(), updateOne: jest.fn() },
  Groups: { findById: jest.fn() },
  Mailings: {},
  Galleries: {},
  Users: {},
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));
jest.mock(
  '../../../packages/server/template/generate-preview.controller.js',
  () => {
    const answer = (req, res) => res.json({});
    return {
      previewMarkup: answer,
      generatePreviews: answer,
      previewEvents: answer,
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
} = require('../../../packages/server/common/models.common.js');
const { ROLES } = require('../../../packages/shared/access/roles.js');
const {
  actorFrom,
  bootstrap,
} = require('../../helpers/super-admin-fixtures.js');

const OWN_GROUP = '507f1f77bcf86cd799439b01';
const OTHER_GROUP = '507f1f77bcf86cd799439b02';
const OWN_TEMPLATE = '507f1f77bcf86cd799439c01';
const OTHER_TEMPLATE = '507f1f77bcf86cd799439c02';
const ORPHAN_TEMPLATE = '507f1f77bcf86cd799439c03';
const MISSING_TEMPLATE = '507f1f77bcf86cd799439c04';
// A template whose group moved a threshold past the template's own since.
const MOVED_GROUP = '507f1f77bcf86cd799439b03';
const MOVED_TEMPLATE = '507f1f77bcf86cd799439c05';

// A template's markup weighs megabytes: it must never be read nor sent back.
const HEAVY_MARKUP = `<html>${'x'.repeat(5 * 1024 * 1024)}</html>`;

const GROUPS = {
  [OWN_GROUP]: {
    _id: OWN_GROUP,
    enableEmailBuilder: true,
    qualitySettings: { checks: { subject: { thresholds: { tooLong: 80 } } } },
  },
  [OTHER_GROUP]: { _id: OTHER_GROUP, enableEmailBuilder: true },
  [MOVED_GROUP]: {
    _id: MOVED_GROUP,
    enableEmailBuilder: true,
    qualitySettings: { checks: { subject: { thresholds: { tooLong: 45 } } } },
  },
};

const template = (_id, _company) => ({
  _id,
  name: 'Newsletter',
  _company,
  markup: HEAVY_MARKUP,
  qualitySettings: { checks: { headings: { state: 'off' } } },
});
const TEMPLATES = {
  [OWN_TEMPLATE]: template(OWN_TEMPLATE, OWN_GROUP),
  [OTHER_TEMPLATE]: template(OTHER_TEMPLATE, OTHER_GROUP),
  // A template no company holds yet: only a super admin reaches it.
  [ORPHAN_TEMPLATE]: template(ORPHAN_TEMPLATE, undefined),
  // long 50 was set when the group's tooLong was 60; it is 45 now.
  [MOVED_TEMPLATE]: {
    ...template(MOVED_TEMPLATE, MOVED_GROUP),
    qualitySettings: { checks: { subject: { thresholds: { long: 50 } } } },
  },
};

// The templates as stored for a test: the writes apply to them, field by
// field, as `updateOne` with `$set` and `$unset` on dotted paths would.
let templates;
function storedTemplates() {
  return Object.fromEntries(
    Object.entries(TEMPLATES).map(([id, doc]) => [
      id,
      {
        ...doc,
        qualitySettings: JSON.parse(JSON.stringify(doc.qualitySettings)),
      },
    ])
  );
}
function applyWrites(doc, { $set = {}, $unset = {} }) {
  const at = (path) => {
    const keys = path.split('.');
    const last = keys.pop();
    const parent = keys.reduce((node, key) => {
      if (!node[key]) node[key] = {};
      return node[key];
    }, doc);
    return [parent, last];
  };
  Object.entries($set).forEach(([path, value]) => {
    const [parent, key] = at(path);
    parent[key] = value;
  });
  Object.keys($unset).forEach((path) => {
    const [parent, key] = at(path);
    delete parent[key];
  });
}

// `findById(id).select('a b').lean()`, keeping only the selected fields; what
// each read selected is kept in `selections`.
const selections = [];
function projected(store, id) {
  return {
    select: (fields) => ({
      lean: () => {
        selections.push([store, fields]);
        const doc = store[String(id)];
        if (!doc) return Promise.resolve(null);
        const kept = ['_id', ...fields.split(' ')];
        return Promise.resolve(
          Object.fromEntries(
            Object.entries(doc).filter(([key]) => kept.includes(key))
          )
        );
      },
    }),
  };
}

const userWith = (role, group = OWN_GROUP) =>
  actorFrom({
    _id: '507f1f77bcf86cd799439101',
    name: 'Someone',
    role,
    _company: group,
  });

let router;
beforeAll(() => {
  // required here, once the stand-ins above are in place
  router = require('../../../packages/server/template/template.routes.js');
});

function app(user) {
  const server = express();
  server.use(express.json());
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

// Valid on any template, whatever its group sets.
const BODY = { checks: { 'emoji-placement': { state: 'off' } } };
// 70 is over the default tooLong, under the own group's 80.
const LONG_SUBJECT = { checks: { subject: { thresholds: { long: 70 } } } };
const put = (user, templateId, body = BODY) =>
  request(app(user))
    .put(`/api/templates/${templateId}/quality-settings`)
    .send(body);

beforeEach(() => {
  jest.clearAllMocks();
  selections.length = 0;
  templates = storedTemplates();
  Templates.findById.mockImplementation((id) => projected(templates, id));
  Templates.updateOne.mockImplementation(async (filter, update) => {
    applyWrites(templates[String(filter._id)], update);
    return { acknowledged: true };
  });
  Groups.findById.mockImplementation((id) => projected(GROUPS, id));
});

describe('PUT /api/templates/:templateId/quality-settings — rights', () => {
  it.each([
    // who, own company's template, another company's, one no company holds
    ['a super admin', 200, 200, 200, userWith(ROLES.SUPER_ADMIN)],
    ['the bootstrap account', 200, 200, 200, bootstrap],
    ['a tech admin', 200, 403, 403, userWith(ROLES.GROUP_ADMIN_TECH)],
    ['a company admin', 200, 403, 403, userWith(ROLES.GROUP_ADMIN)],
    ['a writer', 401, 401, 401, userWith(ROLES.WRITER)],
    ['a reviewer', 401, 401, 401, userWith(ROLES.REVIEWER)],
    ['a regular user', 401, 401, 401, userWith(ROLES.REGULAR_USER)],
  ])(
    'answers %s with %i on its own company, %i on another, %i without company',
    async (_label, own, other, orphan, user) => {
      expect((await put(user, OWN_TEMPLATE)).status).toBe(own);
      expect((await put(user, OTHER_TEMPLATE)).status).toBe(other);
      expect((await put(user, ORPHAN_TEMPLATE)).status).toBe(orphan);
      const writes = [own, other, orphan].filter((s) => s === 200).length;
      expect(Templates.updateOne).toHaveBeenCalledTimes(writes);
      if (own === 401) expect(Templates.findById).not.toHaveBeenCalled();
    }
  );

  it("refuses a company admin of another company on this company's template", async () => {
    const res = await put(
      userWith(ROLES.GROUP_ADMIN, OTHER_GROUP),
      OWN_TEMPLATE
    );

    expect(res.status).toBe(403);
    expect(Templates.updateOne).not.toHaveBeenCalled();
  });

  it('answers not found for a template that does not exist', async () => {
    const res = await put(userWith(ROLES.SUPER_ADMIN), MISSING_TEMPLATE);

    expect(res.status).toBe(404);
    expect(res.body.message).toBe('TEMPLATE_NOT_FOUND');
  });
});

describe('PUT /api/templates/:templateId/quality-settings — payload', () => {
  it('reads only what the check, the write and the answer need, never the markup', async () => {
    await put(userWith(ROLES.GROUP_ADMIN), OWN_TEMPLATE);

    // Before the write, then the settings alone once written.
    const templateReads = selections.filter(([store]) => store === templates);
    expect(
      templateReads.map(([, fields]) => fields.split(' ').sort())
    ).toEqual([['_company', 'qualitySettings'], ['qualitySettings']]);
  });

  it("answers with the template's quality settings only", async () => {
    const res = await put(
      userWith(ROLES.GROUP_ADMIN),
      OWN_TEMPLATE,
      LONG_SUBJECT
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      qualitySettings: {
        checks: {
          headings: { state: 'off' },
          subject: { thresholds: { long: 70 } },
        },
      },
    });
    expect(res.text.length).toBeLessThan(1024);
  });

  it('writes only the checks that change, and nothing else, on that template', async () => {
    await put(userWith(ROLES.GROUP_ADMIN), OWN_TEMPLATE, LONG_SUBJECT);

    expect(Templates.updateOne).toHaveBeenCalledWith(
      { _id: OWN_TEMPLATE },
      {
        $set: {
          'qualitySettings.checks.subject': { thresholds: { long: 70 } },
        },
      }
    );
  });

  it("checks the order against the group's values", async () => {
    // 90 is over the group's tooLong of 80.
    const res = await put(userWith(ROLES.GROUP_ADMIN), OWN_TEMPLATE, {
      checks: { subject: { thresholds: { long: 90 } } },
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('INVALID_QUALITY_SETTINGS');
    expect(Templates.updateOne).not.toHaveBeenCalled();
  });
});

describe('PUT /api/templates/:templateId/quality-settings — a group that moved since', () => {
  const superAdmin = userWith(ROLES.SUPER_ADMIN);

  it("accepts the template's settings sent back unchanged", async () => {
    const res = await put(superAdmin, MOVED_TEMPLATE, {
      checks: {
        subject: { thresholds: { long: 50, tooLong: null } },
        headings: { state: 'off' },
      },
    });

    expect(res.status).toBe(200);
    expect(res.body.qualitySettings.checks.subject).toEqual({
      thresholds: { long: 50 },
    });
  });

  it('refuses a new value of the template that contradicts the group', async () => {
    const res = await put(superAdmin, MOVED_TEMPLATE, {
      checks: { subject: { thresholds: { long: 55, tooLong: null } } },
    });

    expect(res.status).toBe(422);
    expect(res.body.message).toBe('INVALID_QUALITY_SETTINGS');
    expect(Templates.updateOne).not.toHaveBeenCalled();
  });
});
