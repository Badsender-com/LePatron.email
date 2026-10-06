/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  parseColor,
  contrastRatio,
} = require('../../../packages/editor/src/js/ext/quality/colors.js');
const { fakeViewModel, exportOf } = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const smallFont = require(`${RULES}/small-font`);
const hiddenText = require(`${RULES}/hidden-text`);
const colorContrast = require(`${RULES}/color-contrast`);
const textLayout = require(`${RULES}/text-layout`);
const indistinctLinks = require(`${RULES}/indistinct-links`);
const headings = require(`${RULES}/headings`);
const altRedundant = require(`${RULES}/alt-redundant`);
const emojiPlacement = require(`${RULES}/emoji-placement`);

const DEFAULT_TEXT = '<p style="font-size:12px">Sample</p>';
const def = { type: 'textBlock', longText: DEFAULT_TEXT };

// A text block whose rich text the client wrote; its export shows the same
// markup, inside a block background of `bg`.
function richTextFindings(
  rule,
  longText,
  { bg = '#ffffff', type = 'textBlock' } = {}
) {
  const html = exportOf({
    b1: `<table><tr><td bgcolor="${bg}">${longText}</td></tr></table>`,
  });
  const blocks = [{ id: 'b1', type, longText }];
  const blockDefs = [def, { ...def, type }];
  return runQualityChecks(fakeViewModel({ blocks, blockDefs, html }), {
    rules: [rule],
  }).findings;
}

describe('colors', () => {
  it('reads the colours of inline styles', () => {
    expect(parseColor('#FFF')).toBe('#ffffff');
    expect(parseColor('rgb(255, 0, 0)')).toBe('#ff0000');
    expect(parseColor('rgba(0,0,0,0.5)')).toBeNull();
    expect(parseColor('var(--brand)')).toBeNull();
  });

  it('computes the WCAG ratio', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe('small-font', () => {
  it('warns about a size the client set under 14 px', () => {
    const [finding] = richTextFindings(
      smallFont,
      '<p><span style="font-size: 11px">Terms apply</span></p>'
    );
    expect(finding).toMatchObject({
      severity: 'warning',
      params: { size: 11, min: 14 },
    });
  });

  it('allows 12 px in header and footer blocks', () => {
    const text = '<p><span style="font-size: 12px">Legal notice</span></p>';
    expect(richTextFindings(smallFont, text, { type: 'footerBlock' })).toEqual(
      []
    );
    expect(
      richTextFindings(smallFont, text, { type: 'preheaderHeader' })
    ).toEqual([]);
    const [finding] = richTextFindings(
      smallFont,
      '<p><span style="font-size: 11px">Legal notice</span></p>',
      { type: 'footerBlock' }
    );
    expect(finding.params).toMatchObject({ size: 11, min: 12 });
  });

  it('converts points', () => {
    const [finding] = richTextFindings(
      smallFont,
      '<p style="font-size:9pt">Terms</p>'
    );
    expect(finding.params.size).toBe(12);
  });

  it("never judges the template's own size, nor an untouched text", () => {
    expect(
      richTextFindings(smallFont, '<p style="font-size:12px">My own words</p>')
    ).toEqual([]);
    expect(richTextFindings(smallFont, DEFAULT_TEXT)).toEqual([]);
    expect(
      richTextFindings(smallFont, '<p style="font-size:16px">Fine</p>')
    ).toEqual([]);
  });
});

describe('hidden-text', () => {
  it.each([
    '<p style="display:none">Secret offer</p>',
    '<span style="font-size:1px">tiny</span>',
    '<span style="opacity:0">ghost</span>',
  ])('reports hidden text in %s', (longText) => {
    const [finding] = richTextFindings(hiddenText, longText);
    expect(finding).toMatchObject({ severity: 'error' });
  });

  it('leaves an empty hidden element alone', () => {
    expect(
      richTextFindings(
        hiddenText,
        '<span style="display:none"></span><p>Hi</p>'
      )
    ).toEqual([]);
  });
});

describe('color-contrast', () => {
  it('warns about a light grey on white', () => {
    const [finding] = richTextFindings(
      colorContrast,
      '<p><span style="color:#999999">Soft grey text</span></p>'
    );
    expect(finding).toMatchObject({
      severity: 'warning',
      params: { required: 4.5, ideal: 7 },
    });
  });

  it('reports text in the colour of its background as an error', () => {
    const [finding] = richTextFindings(
      colorContrast,
      '<p><span style="color:#fefefe">White on white</span></p>'
    );
    expect(finding.severity).toBe('error');
  });

  it("reads the block's background from the export", () => {
    expect(
      richTextFindings(
        colorContrast,
        '<p><span style="color:#ffffff">Light</span></p>',
        { bg: '#093040' }
      )
    ).toEqual([]);
  });

  it('accepts 3:1 for large text', () => {
    expect(
      richTextFindings(
        colorContrast,
        '<h1><span style="color:#888888;font-size:28px">Big title</span></h1>'
      )
    ).toEqual([]);
  });

  it('says nothing over a background image', () => {
    const html = exportOf({
      b1:
        '<table><tr><td style="background-image:url(a.jpg)"><span style="color:#eeeeee">Over a photo</span></td></tr></table>',
    });
    const blocks = [
      {
        id: 'b1',
        type: 'textBlock',
        longText: '<span style="color:#eeeeee">Over a photo</span>',
      },
    ];
    expect(
      runQualityChecks(fakeViewModel({ blocks, blockDefs: [def], html }), {
        rules: [colorContrast],
      }).findings
    ).toEqual([]);
  });
});

describe('text-layout', () => {
  it.each([
    [
      '<p style="text-align: justify">Long paragraph</p>',
      'Justified text: word gaps get harder to read: __text__',
    ],
    [
      '<p style="line-height:0.9">Overlapping lines</p>',
      'Line height under 1 (__ratio__): the lines overlap: __text__',
    ],
    [
      '<p style="font-size:20px;line-height:18px">Overlapping too</p>',
      'Line height under 1 (__ratio__): the lines overlap: __text__',
    ],
  ])('notes %s', (longText, messageKey) => {
    expect(
      richTextFindings(textLayout, longText).map((f) => f.messageKey)
    ).toEqual([messageKey]);
  });

  it('warns about overlapping lines', () => {
    const [finding] = richTextFindings(
      textLayout,
      '<p style="line-height:0.8">Overlapping lines</p>'
    );
    expect(finding.severity).toBe('warning');
  });

  it('leaves comfortable text alone, a line height of 1.1 included', () => {
    expect(
      richTextFindings(
        textLayout,
        '<p style="line-height:150%;text-align:left">Fine</p><p style="line-height:1.1">Tight but fine</p>'
      )
    ).toEqual([]);
  });

  it('notes long centred text once for the whole email', () => {
    const long = 'word '.repeat(50);
    const findings = richTextFindings(
      textLayout,
      `<p style="text-align:center">${long}</p><p style="text-align:center">${long}</p>`
    );
    expect(findings).toEqual([
      expect.objectContaining({
        messageKey:
          'Centred text over about three lines is hard to read: align long texts to the left',
        blockId: null,
      }),
    ]);
  });

  it('leaves short centred text alone', () => {
    expect(
      richTextFindings(textLayout, '<p style="text-align:center">Our offer</p>')
    ).toEqual([]);
  });
});

describe('indistinct-links', () => {
  it('notes a link in a sentence, not underlined and of the same colour', () => {
    const findings = richTextFindings(
      indistinctLinks,
      '<p style="color:#333333">Read <a href="https://brand.com" style="color:#333333;text-decoration:none">our terms</a> first.</p>'
    );
    expect(findings).toHaveLength(1);
  });

  it('leaves underlined links, coloured links and lone buttons alone', () => {
    const texts = [
      '<p style="color:#333">Read <a href="#x" style="color:#333">our terms</a> first.</p>',
      '<p style="color:#333">Read <a href="#x" style="color:#0055ff;text-decoration:none">our terms</a> first.</p>',
      '<p style="color:#333"><a href="#x" style="color:#333;text-decoration:none">Shop now</a></p>',
    ];
    texts.forEach((t) =>
      expect(richTextFindings(indistinctLinks, t)).toEqual([])
    );
  });
});

describe('headings', () => {
  it('notes an empty heading and a skipped level', () => {
    const keys = richTextFindings(
      headings,
      '<h2>Offer</h2><h4>Details</h4><h3></h3>'
    ).map((f) => f.messageKey);
    expect(keys).toEqual([
      'Heading level skipped: __from__ followed by __to__',
      'Empty heading (__tag__)',
    ]);
  });

  it('leaves a clean outline alone', () => {
    expect(
      richTextFindings(headings, '<h2>Offer</h2><h3>Details</h3><h2>More</h2>')
    ).toEqual([]);
  });
});

describe('alt-redundant', () => {
  it('notes an alternative text repeating its caption', () => {
    const html = exportOf({
      b1: '<img src="a.jpg" alt="New serum"><p>New serum</p>',
    });
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    expect(
      runQualityChecks(fakeViewModel({ blocks, html }), {
        rules: [altRedundant],
      }).findings
    ).toHaveLength(1);
  });

  it('leaves a distinct alternative text alone', () => {
    const html = exportOf({
      b1: '<img src="a.jpg" alt="A bottle of serum on a rock"><p>New serum</p>',
    });
    const blocks = [{ id: 'b1', type: 'imageBlock' }];
    expect(
      runQualityChecks(fakeViewModel({ blocks, html }), {
        rules: [altRedundant],
      }).findings
    ).toEqual([]);
  });
});

describe('emoji-placement', () => {
  const findingsOf = (text) =>
    runQualityChecks(
      fakeViewModel({
        blocks: [{ id: 'b1', type: 'textBlock' }],
        html: exportOf({ b1: `<p>${text}</p>` }),
      }),
      { rules: [emojiPlacement] }
    ).findings.map((f) => f.messageKey);

  it.each([
    [
      'Our 🔥 sale starts today',
      'Emoji in the middle of a sentence: screen readers read its name there',
    ],
    [
      'Sale today 🔥🔥',
      'Several emojis in a row: screen readers read each name',
    ],
  ])('notes "%s"', (text, key) => {
    expect(findingsOf(text)).toEqual([key]);
  });

  it('leaves an emoji at the end of a sentence alone', () => {
    expect(findingsOf('Our sale starts today 🔥')).toEqual([]);
    expect(findingsOf('Merci ❤️ À bientôt')).toEqual([]);
    expect(findingsOf('Thanks to our nurses 👩‍⚕️')).toEqual([]);
    expect(findingsOf('Well done 👍🏽')).toEqual([]);
    expect(findingsOf('Made in France 🇫🇷')).toEqual([]);
  });
});
