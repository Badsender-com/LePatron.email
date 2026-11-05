'use strict';

/**
 * Acceptance tests of the AI tools hidden from whoever may not edit the
 * content (ADR 0020).
 *
 * Seam: `findOneForMosaico`, which configures the editor. It tells the editor,
 * once and before it starts, whether this user may use text generation on this
 * email: the feature on for the company, the capability to edit the content,
 * and the right to write where the email lives, the rule of the text
 * generation routes. `hasTextGenerationFeature` keeps meaning "on for the
 * company".
 *
 * Turned on by the PR of the `canUseTextGeneration` flag.
 */

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn().mockResolvedValue(null),
  getEditorFeatureFlags: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  userCanEditMailing: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common.js', () => ({
  TaxonomyItems: { find: jest.fn(), findOne: jest.fn() },
  Mailings: {},
  Groups: { findById: () => ({ lean: () => Promise.resolve({}) }) },
}));

const mongoose = require('mongoose');
const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service');
const mailingService = require('../../../packages/server/mailing/mailing.service.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');

function metadataFor({ role, feature = true, canWrite = true }) {
  aiFeatureService.getEditorFeatureFlags.mockResolvedValue({
    hasTranslationFeature: false,
    hasTextGenerationFeature: feature,
  });
  mailingService.userCanEditMailing.mockResolvedValue(canWrite);
  const mailing = {
    _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439055'),
    name: 'Campagne',
    data: {},
    previewHtml: '',
    _workspace: mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    _company: { _id: COMPANY, id: String(COMPANY), name: 'Company A' },
    _wireframe: {
      _id: mongoose.Types.ObjectId('507f1f77bcf86cd799439201'),
      name: 'News',
      _company: COMPANY,
      assets: {},
    },
  };
  const model = {
    findOne: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mailing),
      }),
    }),
  };
  mongoose.models = {
    Company: {
      findById: jest.fn().mockResolvedValue({ _id: COMPANY, name: 'A' }),
    },
    Comment: null,
  };
  const user = { _id: mongoose.Types.ObjectId(), role, _company: COMPANY };
  return MailingSchema.statics.findOneForMosaico
    .call(model, user, {})
    .then((result) => result.metadata);
}

describe.skip('findOneForMosaico — canUseTextGeneration (ADR 0020)', () => {
  it.each(['writer', 'regular_user', 'company_admin', 'super_admin'])(
    'is true for a %s who may write where the email lives',
    async (role) => {
      expect((await metadataFor({ role })).canUseTextGeneration).toBe(true);
    }
  );

  it('is false for a reviewer, the feature on for the company', async () => {
    const metadata = await metadataFor({ role: 'reviewer' });
    expect(metadata.canUseTextGeneration).toBe(false);
    expect(metadata.hasTextGenerationFeature).toBe(true);
  });

  it('is false without the right to write where the email lives', async () => {
    const metadata = await metadataFor({ role: 'writer', canWrite: false });
    expect(metadata.canUseTextGeneration).toBe(false);
  });

  it('is false when the company has no text generation', async () => {
    const metadata = await metadataFor({
      role: 'company_admin',
      feature: false,
    });
    expect(metadata.canUseTextGeneration).toBe(false);
  });
});
