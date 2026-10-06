'use strict';

// Shared by the duplicate + translate tests: the mocked job store, database,
// provider and logger, the driver that runs the controller to the end of its
// background job, and the composed-block fixtures
// (composed-block.fixtures.js).
//
// Required before anything it mocks. The jest.mock calls below register on the
// test's module registry when this file loads, so a test file that requires the
// harness first gets the mocks everywhere — and can still mock more on its own
// (translation.service, for the tests that stub the whole translation).

jest.mock('../../../packages/server/translation/translation-jobs', () => ({
  createJob: jest.fn(),
  isCancelled: jest.fn(),
  setTotals: jest.fn(),
  updateBatchProgress: jest.fn(),
  setCompleted: jest.fn(),
  setFailed: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service', () => ({
  findOneForUser: jest.fn(),
  duplicateWithTranslatedData: jest.fn(),
  updatePreviewHtml: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common', () => ({
  Templates: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/ai-feature/ai-feature.service', () => ({
  getActiveFeatureWithIntegration: jest.fn(),
}));
jest.mock(
  '../../../packages/server/integration-providers/provider-factory',
  () => ({ createProvider: jest.fn() })
);
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const translationJobs = require('../../../packages/server/translation/translation-jobs');
const mailingService = require('../../../packages/server/mailing/mailing.service');
const { Templates } = require('../../../packages/server/common/models.common');
const aiFeatureService = require('../../../packages/server/ai-feature/ai-feature.service');
const ProviderFactory = require('../../../packages/server/integration-providers/provider-factory');
const controller = require('../../../packages/server/translation/translation.controller.js');
const { composedBlock, element } = require('./composed-block.fixtures.js');

const zone = (rootClass, markerClass, inner) =>
  `<div class="${rootClass}"><div class="${markerClass}">${inner}</div></div>`;

// A provider answering every text through `translate`, plus `extra`.
function givenProvider(translate, extra = {}) {
  ProviderFactory.createProvider.mockReturnValue({
    translateBatch: jest.fn(async ({ texts }) => ({
      ...Object.fromEntries(
        Object.entries(texts).map(([key, value]) => [key, translate(value)])
      ),
      ...extra,
    })),
  });
}

// Clears every mock and gives each collaborator the answer a successful job
// needs. The source mailing and the template are left to each test.
function resetMocks() {
  jest.clearAllMocks();
  translationJobs.createJob.mockResolvedValue({ jobId: 'job' });
  translationJobs.isCancelled.mockResolvedValue(false);
  aiFeatureService.getActiveFeatureWithIntegration.mockResolvedValue({
    integration: { provider: 'openai' },
    feature: { config: { availableLanguages: ['fr', 'en'] } },
  });
  mailingService.duplicateWithTranslatedData.mockResolvedValue({
    _id: 'copy',
    name: 'Source - EN',
  });
}

/**
 * The controller answers 202 and translates in the background: resolves once
 * the job completes, with what it stored — the job result, the copy's data and
 * the copy's previewHtml.
 */
async function duplicateAndTranslate() {
  const completed = new Promise((resolve) => {
    translationJobs.setCompleted.mockImplementation(async (_id, result) =>
      resolve(result)
    );
    translationJobs.setFailed.mockImplementation(async (_id, message) =>
      resolve(new Error(message))
    );
  });
  await controller.duplicateAndTranslate(
    {
      user: { id: 'user', group: { id: 'group' } },
      params: { mailingId: 'source' },
      body: { targetLanguage: 'en', sourceLanguage: 'fr' },
    },
    { status: jest.fn().mockReturnThis(), json: jest.fn() },
    jest.fn()
  );
  const result = await completed;
  expect(result).not.toBeInstanceOf(Error);

  const [duplicated] = mailingService.duplicateWithTranslatedData.mock.calls;
  const [updated] = mailingService.updatePreviewHtml.mock.calls;
  return {
    result,
    data: duplicated && duplicated[0].translatedData,
    preview: updated && updated[1],
  };
}

module.exports = {
  translationJobs,
  mailingService,
  Templates,
  element,
  composedBlock,
  zone,
  givenProvider,
  resetMocks,
  duplicateAndTranslate,
};
