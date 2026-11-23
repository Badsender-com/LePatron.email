/**
 * @jest-environment jsdom
 */

'use strict';

const {
  runQualityChecks,
} = require('../../../packages/editor/src/js/ext/quality/engine.js');
const {
  TRANSPARENT_GIF,
} = require('../../../packages/editor/src/js/ext/quality/ownership.js');
const { copyViewModel, exportOf } = require('./fake-view-model');
const VERSAFIX_BLOCKS = require('../../../packages/editor/spec/data/template-versafix-1.blocks.json');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const mergeTags = require(`${RULES}/merge-tags`);
const emptyBlocks = require(`${RULES}/empty-blocks`);
const uppercaseText = require(`${RULES}/uppercase-text`);

const findingsOf = (rule, options) =>
  runQualityChecks(copyViewModel(options), { rules: [rule] }).findings;

describe('merge-tags', () => {
  const blocks = [{ id: 'b1', type: 'textBlock' }];

  it.each([
    '<p>Hello {{first_name,</p>',
    '<p>Hello %%FIRSTNAME, welcome</p>',
    '<p>Hi *|FNAME, welcome</p>',
    '<a href="https://brand.com/?u={{id">Go</a>',
    '<p>Hello <span style="display:none">{{first_name,</span></p>',
    '<p>Hello <span style="mso-hide:all">{{first_name,</span></p>',
  ])('reports an unclosed tag in %s', (blockHtml) => {
    const html = exportOf({ b1: blockHtml });
    const [finding] = findingsOf(mergeTags, { blocks, html });
    expect(finding).toMatchObject({ severity: 'error', blockId: 'b1' });
  });

  it('judges each text and each link on its own', () => {
    const html = exportOf({
      b1: '<p>Hello {{first_name,</p><a href="https://brand.com/?u=x}}">Go</a>',
    });
    expect(findingsOf(mergeTags, { blocks, html })).toHaveLength(2);
  });

  it('says a lone %% may be a doubled percent sign', () => {
    const html = exportOf({ b1: '<p>-50%% on everything</p>' });
    const [finding] = findingsOf(mergeTags, { blocks, html });
    expect(finding.messageKey).toBe(
      'Unbalanced %% (__excerpt__): a personalization tag left open, or a doubled percent sign'
    );
  });

  it('reports one in the subject and the preheader', () => {
    const findings = findingsOf(mergeTags, {
      subjectValue: 'Hello {{name',
      preheaderValue: 'Welcome %%NAME',
    });
    expect(findings.map((f) => f.propertyPath)).toEqual([
      'subject',
      'preheader',
    ]);
    expect(findings[1].messageKey).toBe(
      'Unbalanced %% in the preheader (__excerpt__): a personalization tag left open, or a doubled percent sign'
    );
  });

  it('fingerprints the tag and the words around it, not the whole text', () => {
    const fingerprintOf = (text) =>
      findingsOf(mergeTags, {
        blocks,
        html: exportOf({ b1: `<p>${text}</p>` }),
      })[0].fingerprint;
    const text = 'Hello {{first_name, welcome to our spring sale';
    expect(fingerprintOf(text)).toBe(fingerprintOf(`${text} and more`));
    expect(fingerprintOf(text)).not.toBe(
      fingerprintOf('Hi {{first_name, welcome')
    );
  });

  it('leaves balanced tags alone', () => {
    const html = exportOf({
      b1: '<p>Hello {{first_name}}, %%CITY%% *|FNAME|*</p>',
    });
    expect(
      findingsOf(mergeTags, { blocks, html, subjectValue: 'Hi {{name}}' })
    ).toEqual([]);
  });
});

describe('empty-blocks', () => {
  const textDef = { type: 'textBlock', longText: '<p>Write here</p>' };
  const spacerDef = { type: 'spacerBlock', height: '20' };

  it('warns about a text block emptied by the client', () => {
    const html = exportOf({ b1: '<p> </p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: 'textBlock', longText: '' }],
      blockDefs: [textDef],
      html,
    });
    expect(findings).toHaveLength(1);
  });

  it('leaves spacers, blocks with an image and blocks with text alone', () => {
    const html = exportOf({ b1: '', b2: '<img src="a.jpg">', b3: '<p>Hi</p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [
        { id: 'b1', type: 'spacerBlock' },
        { id: 'b2', type: 'textBlock' },
        { id: 'b3', type: 'textBlock' },
      ],
      blockDefs: [textDef, spacerDef],
      html,
    });
    expect(findings).toEqual([]);
  });

  it('never counts hidden text as shown', () => {
    const html = exportOf({ b1: '<p style="display:none">Hidden</p>' });
    const findings = findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: 'textBlock' }],
      blockDefs: [textDef],
      html,
    });
    expect(findings).toHaveLength(1);
  });

  it('counts a background image the client set as something shown', () => {
    const heroDef = {
      type: 'heroBlock',
      longText: '<p>Hero</p>',
      bgOptions: { bgimage: '' },
    };
    const findings = findingsOf(emptyBlocks, {
      blocks: [
        {
          id: 'b1',
          type: 'heroBlock',
          longText: '',
          bgOptions: {
            bgImageChoice: 'custom',
            bgimage: 'https://cdn.test/mine.png',
          },
        },
      ],
      blockDefs: [heroDef],
      html: exportOf({ b1: '' }),
    });
    expect(findings).toEqual([]);
  });

  it('counts neither the blank GIF of a spacer nor a hidden image as shown', () => {
    const html = exportOf({
      b1: `<img src="${TRANSPARENT_GIF}" width="1">`,
      b2: '<div style="display:none"><img src="a.jpg"></div>',
    });
    const findings = findingsOf(emptyBlocks, {
      blocks: [
        { id: 'b1', type: 'textBlock' },
        { id: 'b2', type: 'textBlock' },
      ],
      blockDefs: [textDef],
      html,
    });
    expect(findings).toHaveLength(2);
  });

  it('knows every text property our templates name (caption, heading…)', () => {
    const findings = findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: 'figureBlock', caption: '' }],
      blockDefs: [{ type: 'figureBlock', caption: '<p>A caption</p>' }],
      html: exportOf({ b1: '' }),
    });
    expect(findings).toHaveLength(1);
  });

  // The template's text is what the listing of a block's text fields reads
  // (ext/block-text-fields.js), every field a reader sees.
  const emptiedFrom = (blockDef) =>
    findingsOf(emptyBlocks, {
      blocks: [{ id: 'b1', type: blockDef.type }],
      blockDefs: [blockDef],
      html: exportOf({ b1: '' }),
    });

  it('reads a button of the template, a link object’s text, as text it ships', () => {
    const findings = emptiedFrom({
      type: 'buttonBlock',
      buttonLink: { text: 'BUTTON', url: '' },
    });
    expect(findings).toHaveLength(1);
  });

  it.each([
    ['a lone merge tag', { titleText: '@[prenom]' }],
    ['a merge tag in a paragraph', { titleText: '<p>@[prenom]</p>' }],
    ['a web address', { longText: 'https://example.com' }],
    ['an email address', { caption: 'contact@example.com' }],
    ['a list of texts', { items: ['Livraison offerte'] }],
  ])('counts %s as text the template ships', (_label, fields) => {
    expect(emptiedFrom({ type: 'shownBlock', ...fields })).toHaveLength(1);
  });

  it.each([
    ['a non-breaking space', { longText: '<p>&nbsp;</p>' }],
    ['a zero-width non-joiner', { longText: '<p>&zwnj;</p>' }],
    ['an ampersand alone', { longText: '<p>&amp;</p>' }],
    [
      'a size or a colour',
      { titleText: '12px', caption: '#fafafa', heading: 'transparent' },
    ],
    ['an alternative text alone', { image: { alt: 'Logo', src: 'a.png' } }],
    ['an alternative text named first', { altText: 'Logo' }],
    ['an address in a list', { items: ['https://example.com'] }],
    [
      'text the markup hides',
      { longText: '<p style="display:none">Bonjour</p>' },
    ],
    ['a stylesheet', { longText: '<style>p { color: red }</style>' }],
  ])('counts %s as no text the template ships', (_label, fields) => {
    expect(emptiedFrom({ type: 'blankBlock', ...fields })).toEqual([]);
  });

  // Whether each block of the versafix template ships text, as the rule sees it.
  it.each([
    ['logoBlock', false],
    ['sideArticleBlock', true],
    ['singleArticleBlock', true],
    ['titleBlock', true],
    ['textBlock', true],
    ['tripleArticleBlock', true],
    ['doubleArticleBlock', true],
    ['hrBlock', false],
    ['buttonBlock', true],
    ['imageBlock', false],
    ['doubleImageBlock', false],
    ['tripleImageBlock', false],
    ['bigSocialBlock', false],
    ['shareBlock', true],
    ['spacerBlock', false],
    ['socialBlock', true],
  ])(
    'reports an emptied versafix %s only if it ships text: %s',
    (type, ships) => {
      const blockDef = VERSAFIX_BLOCKS.find((block) => block.type === type);
      expect(emptiedFrom(blockDef)).toHaveLength(ships ? 1 : 0);
    }
  );
});

describe('uppercase-text', () => {
  const blocks = [{ id: 'b1', type: 'textBlock' }];

  it('notes a long passage in capital letters', () => {
    const html = exportOf({
      b1: '<p>Please NOTE THAT ALL ORDERS SHIP WITHIN TWO DAYS.</p>',
    });
    const [finding] = findingsOf(uppercaseText, { blocks, html });
    expect(finding.params.count).toBe(8);
  });

  it('leaves short acronyms and sentence case alone', () => {
    const html = exportOf({
      b1: '<p>Free shipping in the EU and UK, see FAQ.</p>',
    });
    expect(findingsOf(uppercaseText, { blocks, html })).toEqual([]);
  });
});
