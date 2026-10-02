'use strict';

// Duplicate + translate hands the string replacement over previewHtml the
// generic keys only.
//
// A composed block's texts reach the preview by having the block's zone
// swapped for its rebuilt markup. Replaced as strings as well, their source
// wording was rewritten wherever else it appeared in the document — in a
// template block the protection config keeps in the source language, in an
// attribute — although nothing in those places had been translated.

jest.mock('../../../packages/server/translation/translation-jobs', () => ({
  createJob: jest.fn(),
  isCancelled: jest.fn(),
  setTotals: jest.fn(),
  updateBatchProgress: jest.fn(),
  setCompleted: jest.fn(),
  setFailed: jest.fn(),
}));
jest.mock('../../../packages/server/translation/translation.service', () => ({
  translateMailing: jest.fn(),
  detectSourceLanguage: jest.fn(),
}));
jest.mock('../../../packages/server/mailing/mailing.service', () => ({
  findOneForUser: jest.fn(),
  duplicateWithTranslatedData: jest.fn(),
  updatePreviewHtml: jest.fn(),
}));
jest.mock('../../../packages/server/common/models.common', () => ({
  Templates: { findById: jest.fn() },
}));
jest.mock('../../../packages/server/utils/logger.js', () => ({
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const translationJobs = require('../../../packages/server/translation/translation-jobs');
const translationService = require('../../../packages/server/translation/translation.service');
const mailingService = require('../../../packages/server/mailing/mailing.service');
const { Templates } = require('../../../packages/server/common/models.common');
const controller = require('../../../packages/server/translation/translation.controller.js');

const DOC =
  '<!DOCTYPE html><html><head><title>t</title></head><body>' +
  '<p class="protected">Bonjour</p><img alt="Bonjour" src="a.png">' +
  '<p>Au revoir</p></body></html>';

async function duplicateAndTranslate() {
  const completed = new Promise((resolve) => {
    translationJobs.setCompleted.mockImplementation(async () => resolve());
    translationJobs.setFailed.mockImplementation(async (_id, message) =>
      resolve(message)
    );
  });
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  await controller.duplicateAndTranslate(
    {
      user: { id: 'user', group: { id: 'group' } },
      params: { mailingId: 'source' },
      body: { targetLanguage: 'en', sourceLanguage: 'fr' },
    },
    res,
    jest.fn()
  );
  expect(await completed).toBeUndefined();
  return mailingService.updatePreviewHtml.mock.calls[0][1];
}

describe('duplicate + translate, composed-block keys and the preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    translationJobs.createJob.mockResolvedValue({ jobId: 'job' });
    translationJobs.isCancelled.mockResolvedValue(false);
    Templates.findById.mockResolvedValue({ markup: '' });
    mailingService.findOneForUser.mockResolvedValue({
      _company: 'group',
      _wireframe: 'template',
      name: 'Source',
      data: {},
      previewHtml: DOC,
    });
    mailingService.duplicateWithTranslatedData.mockResolvedValue({
      _id: 'copy',
      name: 'Source - EN',
    });
    translationService.translateMailing.mockResolvedValue({
      mailing: { name: 'Source', data: {} },
      stats: {},
      originalTexts: {
        'builderBlock.mainBlocks.0.0.content': 'Bonjour',
        'data.mainBlocks.blocks.1.text': 'Au revoir',
      },
      translations: {
        'builderBlock.mainBlocks.0.0.content': 'Hello',
        'data.mainBlocks.blocks.1.text': 'Goodbye',
      },
    });
  });

  it('leaves the source wording of a composed block alone elsewhere', async () => {
    const stored = await duplicateAndTranslate();

    expect(stored).toContain('<p class="protected">Bonjour</p>');
    expect(stored).toContain('alt="Bonjour"');
    expect(stored).not.toContain('Hello');
  });

  it('still translates the generic keys', async () => {
    const stored = await duplicateAndTranslate();

    expect(stored).toContain('<p>Goodbye</p>');
  });
});
