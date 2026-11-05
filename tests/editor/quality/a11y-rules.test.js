/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  fakeViewModel,
  exportOf,
  richTextFindings,
  DEFAULT_RICH_TEXT,
} = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const smallFont = require(`${RULES}/small-font`);
const hiddenText = require(`${RULES}/hidden-text`);
const headings = require(`${RULES}/headings`);
const altRedundant = require(`${RULES}/alt-redundant`);
const emojiPlacement = require(`${RULES}/emoji-placement`);

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
    // 13 px: the 12 px of the default text would read as the template's own size.
    const text = '<p><span style="font-size: 13px">Legal notice</span></p>';
    expect(richTextFindings(smallFont, text, { type: 'footerBlock' })).toEqual(
      []
    );
    [
      'headerBlock',
      'headerBlockV2',
      'preheaderBlock',
      'footer-legal',
      'footerSocialBlock',
      'sectionHeader',
    ].forEach((type) =>
      expect(richTextFindings(smallFont, text, { type })).toEqual([])
    );
    const [finding] = richTextFindings(
      smallFont,
      '<p><span style="font-size: 11px">Legal notice</span></p>',
      { type: 'footerBlock' }
    );
    expect(finding.params).toMatchObject({ size: 11, min: 12 });
  });

  it('keeps 14 px in a content block named after a header, or a legal block', () => {
    ['HeaderAndText', 'legalBlock'].forEach((type) => {
      const [finding] = richTextFindings(
        smallFont,
        '<p><span style="font-size: 13px">Body copy</span></p>',
        { type }
      );
      expect(finding.params).toMatchObject({ size: 13, min: 14 });
    });
  });

  it('accepts the minimum itself: 12 px in a footer, 14 px elsewhere', () => {
    expect(
      richTextFindings(smallFont, '<p style="font-size:12px">Legal</p>', {
        type: 'footerBlock',
      })
    ).toEqual([]);
    expect(
      richTextFindings(smallFont, '<p style="font-size:14px">Body</p>')
    ).toEqual([]);
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
    expect(richTextFindings(smallFont, DEFAULT_RICH_TEXT)).toEqual([]);
    expect(
      richTextFindings(smallFont, '<p style="font-size:16px">Fine</p>')
    ).toEqual([]);
  });

  it("takes a reserialised, unchanged text for the template's", () => {
    expect(
      richTextFindings(
        smallFont,
        '<p style="font-size:12px" data-mce-style="font-size: 12px">Sample</p>'
      )
    ).toEqual([]);
  });

  it('judges a rich text whatever the template names it', () => {
    const html = exportOf({ b1: '<p style="font-size:9px">Terms</p>' });
    const blocks = [
      { id: 'b1', type: 'legal', body: '<p style="font-size:9px">Terms</p>' },
    ];
    const blockDefs = [{ type: 'legal', body: '<p>Terms</p>' }];
    expect(
      runQualityChecks(fakeViewModel({ blocks, blockDefs, html }), {
        rules: [smallFont],
      }).findings
    ).toHaveLength(1);
  });

  it('never judges the styles of pasted code: that is no rich text', () => {
    const htmlCode = '<p style="font-size:9px">Pasted</p>';
    const blocks = [{ id: 'b1', type: 'htmlCodeBlock', htmlCode }];
    const html = exportOf({ b1: htmlCode });
    expect(
      runQualityChecks(fakeViewModel({ blocks, html }), { rules: [smallFont] })
        .findings
    ).toEqual([]);
  });

  it('survives a block the model lost', () => {
    const vm = fakeViewModel({
      blocks: [null, { id: 'b1', type: 'textBlock' }],
    });
    const { checks } = runQualityChecks(vm, {
      rules: [smallFont, emojiPlacement],
    });
    expect(checks.map((c) => c.status)).toEqual(['passed', 'passed']);
  });
});

describe('hidden-text', () => {
  it.each([
    '<p style="display:none">Secret offer</p>',
    '<span style="font-size:1px">tiny</span>',
    '<span style="font-size:1px !important">tiny</span>',
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

  it('leaves a clean outline alone, an image with an alt for a heading too', () => {
    expect(
      richTextFindings(headings, '<h2>Offer</h2><h3>Details</h3><h2>More</h2>')
    ).toEqual([]);
    expect(
      richTextFindings(
        headings,
        '<h2><img src="a.jpg" alt="Offer"></h2><h3>Details</h3>'
      )
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
    ).findings;
  const keysOf = (text) => findingsOf(text).map((f) => f.messageKey);

  it.each([
    [
      'Our 🔥 sale starts today',
      'Emoji in the middle of a sentence: screen readers read its name there',
    ],
    [
      'Sale today 🔥🔥',
      'Several emojis in a row: screen readers read each name',
    ],
    [
      'Well done ☝🏽☝🏽',
      'Several emojis in a row: screen readers read each name',
    ],
  ])('notes "%s"', (text, key) => {
    expect(keysOf(text)).toEqual([key]);
  });

  it('leaves an emoji at the end of a sentence alone', () => {
    expect(keysOf('Our sale starts today 🔥')).toEqual([]);
    expect(keysOf('Merci ❤️ À bientôt')).toEqual([]);
    expect(keysOf('Thanks to our nurses 👩‍⚕️')).toEqual([]);
    expect(keysOf('Well done 👍🏽')).toEqual([]);
    expect(keysOf('Made in France 🇫🇷')).toEqual([]);
    expect(keysOf('Discover Brand® coffees')).toEqual([]);
    expect(keysOf('Acme™ products and more')).toEqual([]);
  });

  it('reads flags and keycaps as emojis', () => {
    expect(keysOf('Sale 🇫🇷🇧🇪')).toEqual([
      'Several emojis in a row: screen readers read each name',
    ]);
    expect(keysOf('Top 1️⃣2️⃣')).toEqual([
      'Several emojis in a row: screen readers read each name',
    ]);
  });

  it('fingerprints the words around the emoji, not the whole block', () => {
    const text = 'Our 🔥 sale starts today, hurry up';
    expect(findingsOf(text)[0].fingerprint).toBe(
      findingsOf(`${text} and more`)[0].fingerprint
    );
  });
});
