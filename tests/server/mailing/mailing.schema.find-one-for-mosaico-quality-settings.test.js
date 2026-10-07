'use strict';

// The editor gets the quality settings of a mailing with the rest of its
// metadata: resolved from its template and its group, every check present with
// its state and thresholds (epic #1193, ADR 0004). They are the editor's to read,
// never to send back on save.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  TaxonomyItems: { find: jest.fn(), findOne: jest.fn() },
  Mailings: {},
  Groups: {},
}));

const mongoose = require('mongoose');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');
const {
  EDITOR_ONLY_METADATA_KEYS,
} = require('../../../packages/editor/src/js/utils/editor-only-metadata-keys.js');

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');
const MAILING = mongoose.Types.ObjectId('507f1f77bcf86cd799439055');
const TEMPLATE = mongoose.Types.ObjectId('507f1f77bcf86cd799439201');

function callWith({ groupSettings, templateSettings }) {
  const mailing = {
    _id: MAILING,
    name: 'Campagne',
    data: {},
    previewHtml: '',
    _workspace: mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    _company: { _id: COMPANY, id: String(COMPANY), name: 'Company A' },
    _wireframe: {
      _id: TEMPLATE,
      name: 'News',
      _company: COMPANY,
      assets: {},
      ...(templateSettings ? { qualitySettings: templateSettings } : {}),
    },
  };
  const populateTemplate = jest.fn().mockResolvedValue(mailing);
  const model = {
    findOne: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({ populate: populateTemplate }),
    }),
  };
  mongoose.models = {
    Company: {
      findById: jest.fn().mockResolvedValue({
        _id: COMPANY,
        name: 'Company A',
        ...(groupSettings ? { qualitySettings: groupSettings } : {}),
      }),
    },
    Comment: null,
  };
  return MailingSchema.statics.findOneForMosaico
    .call(model, { isAdmin: false }, {})
    .then((result) => ({ result, populateTemplate }));
}

describe('findOneForMosaico — quality settings', () => {
  it("gives the editor today's defaults when nothing is set", async () => {
    const { result } = await callWith({});
    const { checks } = result.metadata.qualitySettings;
    expect(checks.headings).toEqual({ state: 'on', thresholds: {} });
    expect(checks['tracking-params'].state).toBe('blocking');
  });

  it("resolves the group's settings under the template's", async () => {
    const { result, populateTemplate } = await callWith({
      groupSettings: { checks: { headings: { state: 'off' } } },
      templateSettings: { checks: { subject: { thresholds: { long: 30 } } } },
    });
    const { checks } = result.metadata.qualitySettings;
    expect(checks.headings.state).toBe('off');
    expect(checks.subject.thresholds).toEqual({ long: 30, tooLong: 60 });
    // The template's settings are read with the template.
    expect(populateTemplate.mock.calls[0][0].select.qualitySettings).toBe(1);
  });

  it('is never sent back on save', () => {
    expect(EDITOR_ONLY_METADATA_KEYS).toContain('qualitySettings');
  });
});
