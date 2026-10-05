'use strict';

// Duplicate + translate keeps the source mailing's head CSS in the copy's
// previewHtml. The preview sanitizer drops a whole <style> whose text holds `<`
// followed by a letter, and that previewHtml is what the copy's multi-mailing
// ZIP exports: without re-injection, the copy silently lost its stylesheet.

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
const {
  injectHeadCss,
} = require('../../../packages/shared/head-css/inject-head-css.js');

const HTML_CODE = '<p class="classred">Coucou</p>';
const DOC =
  '<!DOCTYPE html><html><head><title>t</title></head>' +
  '<body><p>Bonjour</p>' +
  '<div class="lp-html-block">' +
  HTML_CODE +
  '</div></body></html>';

const WITH_BLOCK = {
  mainBlocks: {
    blocks: [
      { type: 'textBlock', text: 'Bonjour' },
      { type: 'htmlCodeBlock', htmlCode: HTML_CODE },
    ],
  },
};
const WITHOUT_BLOCK = {
  mainBlocks: { blocks: [{ type: 'textBlock', text: 'Bonjour' }] },
};

// The translated copy keeps the source's blocks: only their texts change.
function givenSource(headCss, data = WITH_BLOCK) {
  mailingService.findOneForUser.mockResolvedValue({
    _company: 'group',
    _wireframe: 'template',
    name: 'Source',
    data,
    headCss,
    previewHtml: injectHeadCss(DOC, headCss),
  });
  translationService.translateMailing.mockResolvedValue({
    mailing: { name: 'Source', data },
    stats: {},
    originalTexts: { 'data.text': 'Bonjour' },
    translations: { 'data.text': 'Hello' },
  });
}

describe('duplicate + translate, head CSS', () => {
  beforeEach(() => {
    resetMocks();
    Templates.findById.mockResolvedValue({ markup: '' });
  });

  it('keeps a stylesheet the sanitizer would drop whole', async () => {
    const css = '/* <table> fix */ .a{color:red}';
    givenSource(css);

    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).toContain('<p>Hello</p>');
    expect(stored).toContain('="true">' + css + '</style></head>');
  });

  it('does not stack a second stylesheet when the first one survived', async () => {
    givenSource('.a{color:red}');

    const { preview: stored } = await duplicateAndTranslate();

    expect(stored.match(/<style/g)).toHaveLength(1);
    expect(stored).toContain('.a{color:red}</style></head>');
  });

  // The CSS follows the HTML code blocks, as in the editor's export: a copy
  // without any carries none, even when the source still stores it.
  it('leaves the CSS out of a copy without any HTML code block', async () => {
    givenSource('/* <table> fix */ .a{color:red}', WITHOUT_BLOCK);

    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).toContain('<p>Hello</p>');
    expect(stored).not.toContain('.a{color:red}');
    expect(stored).not.toContain('data-lp-head-css');
  });

  // A source exported before the rule may still carry the element in its
  // preview: the copy must not inherit a stylesheet styling nothing.
  it('drops a stylesheet the source preview carried without a block', async () => {
    givenSource('.a{color:red}', WITHOUT_BLOCK);

    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).not.toContain('data-lp-head-css');
  });

  it('adds no stylesheet to a mailing without head CSS', async () => {
    givenSource('');

    const { preview: stored } = await duplicateAndTranslate();

    expect(stored).not.toContain('<style');
  });
});
