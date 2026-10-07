'use strict';

// PUT /templates/:templateId/quality-settings: a template overrides its group's
// quality settings one by one (epic #1193, ADR 0004). Like the template's
// tracking settings, a company admin may only touch the templates of their own
// group, a super admin any template.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn() },
  Groups: {},
  Mailings: {},
  Galleries: {},
}));

const {
  Templates,
} = require('../../../packages/server/common/models.common.js');

const GROUP_ID = '507f1f77bcf86cd799439001';
const OTHER_GROUP_ID = '507f1f77bcf86cd799439002';
const TEMPLATE_ID = '507f1f77bcf86cd799439201';

function templateDoc(qualitySettings) {
  return {
    _id: TEMPLATE_ID,
    _company: { toString: () => GROUP_ID },
    qualitySettings,
    save: jest.fn().mockResolvedValue(undefined),
  };
}

const groupAdminOf = (groupId) => ({
  isAdmin: false,
  isGroupAdmin: true,
  group: { id: groupId },
});

const rejection = (promise) =>
  promise.then(
    () => {
      throw new Error('expected a refusal');
    },
    (error) => error
  );

// Turned on by #1199 (override settings on a template)
describe.skip('PUT /templates/:templateId/quality-settings', () => {
  let templates;

  beforeAll(() => {
    templates = require('../../../packages/server/template/template.controller.js');
  });

  async function put({ user, body, stored }) {
    const template = templateDoc(stored);
    Templates.findById.mockResolvedValue(template);
    const res = { json: jest.fn() };
    await templates.updateQualitySettings(
      { params: { templateId: TEMPLATE_ID }, body, user },
      res
    );
    return { template, res };
  }

  beforeEach(() => jest.clearAllMocks());

  it("lets a company admin override a setting on their group's template", async () => {
    const { template } = await put({
      user: groupAdminOf(GROUP_ID),
      body: { checks: { 'small-font': { thresholds: { minSize: 11 } } } },
    });
    expect(template.qualitySettings).toEqual({
      checks: { 'small-font': { thresholds: { minSize: 11 } } },
    });
    expect(template.save).toHaveBeenCalled();
  });

  it('lets a super admin override any template', async () => {
    const { template } = await put({
      user: { isAdmin: true },
      body: { checks: { headings: { state: 'off' } } },
    });
    expect(template.qualitySettings.checks.headings).toEqual({ state: 'off' });
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
    const { template } = await put({
      user: groupAdminOf(GROUP_ID),
      stored: { checks: { headings: { state: 'off' } } },
      body: { checks: { headings: { state: null } } },
    });
    expect(template.qualitySettings).toEqual({ checks: {} });
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
