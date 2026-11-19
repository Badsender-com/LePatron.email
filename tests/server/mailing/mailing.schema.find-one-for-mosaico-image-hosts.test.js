'use strict';

// What the editor is told about the company's image hosts (ADR 0028): the
// export menu offers each of them by its name, and only those that are on and
// whose last validation succeeded. `download` is what the editor reads to build
// its export menu.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn().mockResolvedValue(null),
}));
jest.mock('../../../packages/server/mailing/mailing.service.js', () => ({
  userCanEditMailing: jest.fn().mockResolvedValue(true),
}));
jest.mock(
  '../../../packages/server/mailing/mailing-metadata.service.js',
  () => ({
    buildEditorMetadata: jest.fn().mockResolvedValue(null),
  })
);
// The active integrations of a company, by type: an existing function of the
// integration service, answered here from a fixed list.
jest.mock(
  '../../../packages/server/integration/integration.service.js',
  () => ({
    findActiveByGroupAndType: jest.fn(),
  })
);
jest.mock('../../../packages/server/common/models.common.js', () => ({
  Mailings: {},
  Groups: {},
}));

const mongoose = require('mongoose');
const integrationService = require('../../../packages/server/integration/integration.service.js');
const MailingSchema = require('../../../packages/server/mailing/mailing.schema');

const findOneForMosaico = MailingSchema.statics.findOneForMosaico;

const COMPANY = mongoose.Types.ObjectId('507f1f77bcf86cd799439a01');
const MAILING = mongoose.Types.ObjectId('507f1f77bcf86cd799439055');
const TEMPLATE = mongoose.Types.ObjectId('507f1f77bcf86cd799439201');

const BRAND_A = mongoose.Types.ObjectId('507f1f77bcf86cd799439c01');
const BRAND_B = mongoose.Types.ObjectId('507f1f77bcf86cd799439c02');
const NEVER_TESTED = mongoose.Types.ObjectId('507f1f77bcf86cd799439c03');
const REFUSED = mongoose.Types.ObjectId('507f1f77bcf86cd799439c04');
const SWITCHED_OFF = mongoose.Types.ObjectId('507f1f77bcf86cd799439c05');

const INTEGRATIONS = [
  {
    _id: BRAND_A,
    name: 'Emarsys – Brand A',
    type: 'asset_hosting',
    provider: 'emarsys',
    isActive: true,
    validationStatus: 'valid',
  },
  {
    _id: BRAND_B,
    name: 'Emarsys – Brand B',
    type: 'asset_hosting',
    provider: 'emarsys',
    isActive: true,
    validationStatus: 'valid',
  },
  {
    _id: NEVER_TESTED,
    name: 'Emarsys – new',
    type: 'asset_hosting',
    provider: 'emarsys',
    isActive: true,
    validationStatus: 'pending',
  },
  {
    _id: REFUSED,
    name: 'Emarsys – old key',
    type: 'asset_hosting',
    provider: 'emarsys',
    isActive: true,
    validationStatus: 'invalid',
  },
  {
    _id: SWITCHED_OFF,
    name: 'Emarsys – off',
    type: 'asset_hosting',
    provider: 'emarsys',
    isActive: false,
    validationStatus: 'valid',
  },
  {
    _id: mongoose.Types.ObjectId(),
    name: 'OpenAI',
    type: 'ai',
    provider: 'openai',
    isActive: true,
    validationStatus: 'valid',
  },
].map((i) => ({ ...i, _company: COMPANY, id: String(i._id) }));

function context(integrations = INTEGRATIONS) {
  integrationService.findActiveByGroupAndType.mockImplementation(
    async ({ groupId, type }) =>
      integrations.filter(
        (i) =>
          String(i._company) === String(groupId) &&
          i.type === type &&
          i.isActive
      )
  );

  const mailing = {
    _id: MAILING,
    name: 'Soldes été',
    data: {},
    previewHtml: '',
    _workspace: mongoose.Types.ObjectId('507f1f77bcf86cd799439301'),
    _company: { _id: COMPANY, id: String(COMPANY), name: 'Company A' },
    _wireframe: { _id: TEMPLATE, name: 'News', _company: COMPANY, assets: {} },
  };
  mongoose.models = {
    Company: {
      findById: jest
        .fn()
        .mockResolvedValue({ _id: COMPANY, name: 'Company A' }),
    },
    Comment: null,
  };
  return {
    findOne: jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mailing),
      }),
    }),
  };
}

// Turned on by #1614 (a user exports an email to Emarsys)
describe.skip("the editor's export menu and the company's image hosts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('offers each image host that is on and validated, by its name', async () => {
    const result = await findOneForMosaico.call(context(), {}, {});

    expect(result.download.imageHosts).toEqual([
      { id: String(BRAND_A), name: 'Emarsys – Brand A' },
      { id: String(BRAND_B), name: 'Emarsys – Brand B' },
    ]);
  });

  it('offers none when the company has no image host', async () => {
    const result = await findOneForMosaico.call(
      context(INTEGRATIONS.filter((i) => i.type !== 'asset_hosting')),
      {},
      {}
    );

    expect(result.download.imageHosts).toEqual([]);
  });

  it('tells the editor nothing of an image host but its name', async () => {
    const result = await findOneForMosaico.call(context(), {}, {});

    result.download.imageHosts.forEach((host) =>
      expect(Object.keys(host).sort()).toEqual(['id', 'name'])
    );
  });
});
