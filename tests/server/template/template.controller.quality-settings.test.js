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

const CHECKS = 'qualitySettings.checks';

function templateDoc(qualitySettings, company = GROUP_ID) {
  return {
    _id: TEMPLATE_ID,
    _company: company,
    qualitySettings,
  };
}

// The template's group, as the route reads it (its quality settings only).
function groupWith(qualitySettings) {
  Groups.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue({ qualitySettings }),
  });
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

  // The update written, check by check, or null when nothing is.
  async function put({ user, body, stored, group, company }) {
    groupWith(group);
    const template = templateDoc(stored, company);
    Templates.findById.mockResolvedValue(template);
    const res = { json: jest.fn() };
    await templates.updateQualitySettings(
      { params: { templateId: TEMPLATE_ID }, body, user },
      res
    );
    const [call] = Templates.updateOne.mock.calls;
    if (call) expect(call[0]).toEqual({ _id: TEMPLATE_ID });
    return { writes: call ? call[1] : null, res };
  }

  beforeEach(() => jest.clearAllMocks());

  it("lets a company admin override a setting on their group's template", async () => {
    const { writes, res } = await put({
      user: groupAdminOf(GROUP_ID),
      body: { checks: { 'small-font': { thresholds: { minSize: 11 } } } },
    });
    expect(writes).toEqual({
      $set: { [`${CHECKS}.small-font`]: { thresholds: { minSize: 11 } } },
    });
    expect(res.json).toHaveBeenCalled();
  });

  it("checks thresholds that go together against the group's values", async () => {
    const group = {
      checks: { subject: { thresholds: { tooLong: 80 } } },
    };
    // 70 is over the default of 60, under the group's 80: allowed.
    const { writes } = await put({
      user: groupAdminOf(GROUP_ID),
      group,
      body: { checks: { subject: { thresholds: { long: 70 } } } },
    });
    expect(writes.$set[`${CHECKS}.subject`]).toEqual({
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
    const { writes } = await put({
      user: { role: 'super_admin' },
      body: { checks: { headings: { state: 'off' } } },
    });
    expect(writes.$set[`${CHECKS}.headings`]).toEqual({ state: 'off' });
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
    const { writes } = await put({
      user: groupAdminOf(GROUP_ID),
      stored: { checks: { headings: { state: 'off' } } },
      body: { checks: { headings: { state: null } } },
    });
    expect(writes).toEqual({ $unset: { [`${CHECKS}.headings`]: '' } });
  });

  it('writes only the checks that change, the others left as they are', async () => {
    const { writes } = await put({
      user: groupAdminOf(GROUP_ID),
      stored: { checks: { 'tracking-params': { state: 'off' } } },
      body: {
        checks: {
          'tracking-params': { state: 'off' },
          headings: { state: 'off' },
        },
      },
    });
    expect(writes).toEqual({
      $set: { [`${CHECKS}.headings`]: { state: 'off' } },
    });
  });

  it('writes nothing when nothing changes', async () => {
    const { writes, res } = await put({
      user: groupAdminOf(GROUP_ID),
      stored: { checks: { headings: { state: 'off' } } },
      body: { checks: { headings: { state: 'off' } } },
    });
    expect(writes).toBeNull();
    expect(res.json).toHaveBeenCalled();
  });

  it('refuses a company admin on a template without a company', async () => {
    const error = await rejection(
      put({
        user: groupAdminOf(GROUP_ID),
        company: null,
        body: { checks: { headings: { state: 'off' } } },
      })
    );
    expect(error.status).toBe(403);
  });

  it('refuses a tech admin of another company', async () => {
    const error = await rejection(
      put({
        user: { role: 'company_admin_tech', group: { id: OTHER_GROUP_ID } },
        body: { checks: { 'tracking-params': { state: 'off' } } },
      })
    );
    expect(error.status).toBe(403);
    expect(Templates.updateOne).not.toHaveBeenCalled();
  });

  // The company's tracking is a tech admin's (ADR 0004), and so is the state
  // of the check of its required parameters, on a template too.
  it("refuses a company admin who overrides the tracking check's state", async () => {
    const error = await rejection(
      put({
        user: groupAdminOf(GROUP_ID),
        body: { checks: { 'tracking-params': { state: 'off' } } },
      })
    );
    expect(error.status).toBe(403);
  });

  it("lets a tech admin override the tracking check's state", async () => {
    const { writes } = await put({
      user: { role: 'company_admin_tech', group: { id: GROUP_ID } },
      body: { checks: { 'tracking-params': { state: 'off' } } },
    });
    expect(writes.$set[`${CHECKS}.tracking-params`]).toEqual({
      state: 'off',
    });
  });

  it.each([
    ['removes', { state: null }],
    ['clears the thresholds of', { state: null, thresholds: null }],
  ])(
    'refuses a company admin who %s the tracking override a tech admin set',
    async (_, change) => {
      const error = await rejection(
        put({
          user: groupAdminOf(GROUP_ID),
          stored: { checks: { 'tracking-params': { state: 'off' } } },
          body: { checks: { 'tracking-params': change } },
        })
      );
      expect(error.status).toBe(403);
      expect(Templates.updateOne).not.toHaveBeenCalled();
    }
  );

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
