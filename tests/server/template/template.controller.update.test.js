'use strict';

// PUT /templates/:templateId (super admin): the template's name, markup,
// assets and options. The quality settings and the tracking each have their
// own route, which validates them (ADR 0009): this one never writes them.

jest.mock('../../../packages/server/common/models.common.js', () => ({
  Templates: { findById: jest.fn() },
  Mailings: { updateMany: jest.fn() },
  Groups: {},
  Galleries: {},
}));
jest.mock('../../../packages/server/common/file-manage.service.js', () => ({
  parseMultipart: jest.fn(),
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

const {
  Templates,
} = require('../../../packages/server/common/models.common.js');
const fileManager = require('../../../packages/server/common/file-manage.service.js');
const templates = require('../../../packages/server/template/template.controller.js');

const TEMPLATE_ID = '507f1f77bcf86cd799439201';

function storedTemplate() {
  return {
    _id: TEMPLATE_ID,
    name: 'Newsletter',
    assets: {},
    qualitySettings: { checks: { headings: { state: 'off' } } },
    trackingConfig: { params: [] },
    markModified: jest.fn(),
    save: jest.fn().mockResolvedValue(undefined),
  };
}

// The template as saved by the route.
async function update(body) {
  const template = storedTemplate();
  fileManager.parseMultipart.mockResolvedValue(body);
  Templates.findById
    .mockResolvedValueOnce(template)
    .mockReturnValueOnce({ populate: jest.fn().mockResolvedValue(template) });
  const res = { json: jest.fn() };
  await templates.update({ params: { templateId: TEMPLATE_ID } }, res);
  expect(template.save).toHaveBeenCalled();
  return template;
}

beforeEach(() => jest.clearAllMocks());

describe('PUT /templates/:templateId', () => {
  it('writes the fields it owns', async () => {
    const saved = await update({
      name: 'Newsletter',
      description: 'Monthly',
      htmlBlockEnabled: 'true',
    });
    expect(saved.description).toBe('Monthly');
    expect(saved.htmlBlockEnabled).toBe(true);
  });

  it.each([
    ['the quality settings', 'qualitySettings', null],
    ['the quality settings', 'qualitySettings', { checks: 'odd' }],
    ['the tracking', 'trackingConfig', { params: 'odd' }],
  ])('leaves %s to their own route', async (_, field, value) => {
    const before = storedTemplate()[field];
    const saved = await update({ name: 'Newsletter', [field]: value });
    expect(saved[field]).toEqual(before);
  });
});
