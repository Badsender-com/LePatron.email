'use strict';

// Duplicate + translate hands the copy the language value of the target, and
// tells the user when it could not (epic #1501, ADR-0023). Which value it is
// belongs to tests/server/translation/translation-locale.test.js; this file
// checks that the job carries it to the copy and to the warnings.

jest.mock('../../../packages/server/translation/translation-locale.js', () => ({
  ...jest.requireActual(
    '../../../packages/server/translation/translation-locale.js'
  ),
  copyLanguageValues: jest.fn(),
}));

const {
  mailingService,
  Templates,
  givenProvider,
  resetMocks,
  duplicateAndTranslate,
} = require('./duplicate-translate.harness.js');
const {
  copyLanguageValues,
} = require('../../../packages/server/translation/translation-locale.js');

const SOURCE = {
  _company: 'group',
  _wireframe: 'template',
  _taxonomyItems: ['belgium', 'french'],
  name: 'Source',
  data: { mainBlocks: { blocks: [{ type: 'titleBlock', text: 'Bienvenue' }] } },
  headCss: '',
  previewHtml: '',
};

beforeEach(() => {
  resetMocks();
  mailingService.findOneForUser.mockResolvedValue(SOURCE);
  Templates.findById.mockResolvedValue({
    markup: '',
    blockBuilderEnabled: false,
  });
  givenProvider((value) => value);
});

describe('duplicate + translate: the language value of the copy', () => {
  it('gives the copy the values the target calls for', async () => {
    copyLanguageValues.mockResolvedValue({
      taxonomyItemIds: ['belgium', 'english'],
      warning: null,
    });

    const { result } = await duplicateAndTranslate();

    expect(copyLanguageValues).toHaveBeenCalledWith({
      mailing: SOURCE,
      targetLanguage: 'en',
    });
    expect(
      mailingService.duplicateWithTranslatedData.mock.calls[0][0]
    ).toMatchObject({ taxonomyItemIds: ['belgium', 'english'] });
    expect(result.warningKeys).not.toContain(
      'translation.warnings.languageValueNotFound'
    );
  });

  it('asks the user to choose the language when none matched', async () => {
    copyLanguageValues.mockResolvedValue({
      taxonomyItemIds: ['belgium'],
      warning: 'TRANSLATION_LANGUAGE_VALUE_NOT_FOUND',
    });

    const { result } = await duplicateAndTranslate();

    expect(result.warningKeys).toContain(
      'translation.warnings.languageValueNotFound'
    );
  });

  it('leaves the values of an email carrying none as they are', async () => {
    mailingService.findOneForUser.mockResolvedValue({
      ...SOURCE,
      _taxonomyItems: [],
    });

    await duplicateAndTranslate();

    expect(copyLanguageValues).not.toHaveBeenCalled();
    expect(
      mailingService.duplicateWithTranslatedData.mock.calls[0][0]
        .taxonomyItemIds
    ).toBeUndefined();
  });
});
