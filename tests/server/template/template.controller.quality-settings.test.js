'use strict';

// PUT /templates/:templateId/quality-settings: a template overrides its group's
// quality settings one by one (epic #1193, ADR 0009). A company admin may only
// touch the templates of their own company, a super admin any template.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn(), updateOne: jest.fn() },
  Groups: { findById: jest.fn() },
  Mailings: {},
  Galleries: {},
}));

// The controller's other routes pull image processing in (sharp): not this one.
jest.mock(
  '../../../packages/server/template/generate-preview.controller.js',
  () => ({})
);
jest.mock(
  '../../../packages/server/template/template-blocks.controller.js',
  () => ({})
);
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({}));

const {
  Templates,
  Groups,
} = require('../../../packages/server/common/models.common.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439002';
const TEMPLATE_ID = '507f1f77bcf86cd799439201';

// The template and its group, as the route reads them: plain objects, with
// only the fields it selects.
const lean = (doc) => ({
  select: jest.fn(() => ({ lean: jest.fn().mockResolvedValue(doc) })),
});

function templateWith(qualitySettings) {
  Templates.findById.mockReturnValue(
    lean({ _id: TEMPLATE_ID, _company: GROUP_ID, qualitySettings })
  );
}

function groupWith(qualitySettings) {
  Groups.findById.mockReturnValue(lean({ qualitySettings }));
}

const groupAdminOf = (groupId) => ({
  role: 'company_admin',
  group: { id: groupId },
});

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected a refusal');
    },
    (error) => error
  );

describe('PUT /templates/:templateId/quality-settings', () => {
  let templates;

  beforeAll(() => {
    templates = require('../../../packages/server/template/template.controller.js');
  });

  // What was written on the template, and what the client got back.
  async function put({ user, body, stored, group }) {
    groupWith(group);
    templateWith(stored);
    const res = { json: jest.fn() };
    await templates.updateQualitySettings(
      { params: { templateId: TEMPLATE_ID }, body, user },
      res
    );
    const [[filter, update]] = Templates.updateOne.mock.calls;
    expect(filter).toEqual({ _id: TEMPLATE_ID });
    expect(res.json).toHaveBeenCalledWith({
      qualitySettings: update.$set.qualitySettings,
    });
    return update.$set;
  }

  beforeEach(() => jest.clearAllMocks());

  it("lets a company admin override a setting on their group's template", async () => {
    const written = await put({
      user: groupAdminOf(GROUP_ID),
      body: { checks: { 'small-font': { thresholds: { minSize: 11 } } } },
    });
    expect(written).toEqual({
      qualitySettings: {
        checks: { 'small-font': { thresholds: { minSize: 11 } } },
      },
    });
  });

  it("checks thresholds that go together against the group's values", async () => {
    const group = {
      checks: { subject: { thresholds: { tooLong: 80 } } },
    };
    // 70 is over the default of 60, under the group's 80: allowed.
    const written = await put({
      user: groupAdminOf(GROUP_ID),
      group,
      body: { checks: { subject: { thresholds: { long: 70 } } } },
    });
    expect(written.qualitySettings.checks.subject).toEqual({
      thresholds: { long: 70 },
    });
    // 90 is over the group's 80: refused.
    const error = await rejection(
      put({
        user: groupAdminOf(GROUP_ID),
        group,
        body: { checks: { subject: { thresholds: { long: 90 } } } },
      })
    );
    expect(error.status).toBe(422);
  });

  it('lets a super admin override any template', async () => {
    const written = await put({
      user: { role: 'super_admin' },
      body: { checks: { headings: { state: 'off' } } },
    });
    expect(written.qualitySettings.checks.headings).toEqual({ state: 'off' });
  });

  it('refuses a company admin of another group with a 403', async () => {
    const error = await rejection(
      put({
        user: groupAdminOf(OTHER_GROUP_ID),
        body: { checks: { headings: { state: 'off' } } },
      })
    );
    expect(error.status).toBe(403);
  });

  it('removes an override with null, back to the group', async () => {
    const written = await put({
      user: groupAdminOf(GROUP_ID),
      stored: { checks: { headings: { state: 'off' } } },
      body: { checks: { headings: { state: null } } },
    });
    expect(written.qualitySettings).toEqual({ checks: {} });
  });

  it('refuses an invalid setting with a 422', async () => {
    const error = await rejection(
      put({
        user: groupAdminOf(GROUP_ID),
        body: { checks: { 'small-font': { thresholds: { minSize: 100 } } } },
      })
    );
    expect(error.status).toBe(422);
    expect(error.message).toBe('INVALID_QUALITY_SETTINGS');
  });
});
