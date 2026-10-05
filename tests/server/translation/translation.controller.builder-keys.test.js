'use strict';

// Duplicate + translate hands the string replacement over previewHtml the
// generic keys only.
//
// A composed block's texts reach the preview by having the block's zone
// swapped for its rebuilt markup. Replaced as strings as well, their source
// wording was rewritten wherever else it appeared in the document — in a
// template block the protection config keeps in the source language, in an
// attribute — although nothing in those places had been translated.

// Stubbed whole: these tests are about what the controller does with a
// translation, not about producing one.
jest.mock('../../../packages/server/translation/translation.service', () => ({
  translateMailing: jest.fn(),
  detectSourceLanguage: jest.fn(),
}));

const {
  mailingService,
  Templates,
  resetMocks,
  duplicateAndTranslate,
} = require('./duplicate-translate.harness.js');
const translationService = require('../../../packages/server/translation/translation.service');

const DOC =
  '<!DOCTYPE html><html><head><title>t</title></head><body>' +
  '<p class="protected">Bonjour</p><img alt="Bonjour" src="a.png">' +
  '<p>Au revoir</p></body></html>';

describe('duplicate + translate, composed-block keys and the preview', () => {
  beforeEach(() => {
    resetMocks();
    Templates.findById.mockResolvedValue({ markup: '' });
    mailingService.findOneForUser.mockResolvedValue({
      _company: 'group',
      _wireframe: 'template',
      name: 'Source',
      data: {},
      previewHtml: DOC,
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
    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).toContain('<p class="protected">Bonjour</p>');
    expect(stored).toContain('alt="Bonjour"');
    expect(stored).not.toContain('Hello');
  });

  it('still translates the generic keys', async () => {
    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).toContain('<p>Goodbye</p>');
  });
});
