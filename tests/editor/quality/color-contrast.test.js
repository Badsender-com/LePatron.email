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
} = require('./fake-view-model');

const RULES = '../../../packages/editor/src/js/ext/quality/rules';
const colorContrast = require(`${RULES}/color-contrast`);
const indistinctLinks = require(`${RULES}/indistinct-links`);

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

  it('reads a background written with spaces, twice, or !important', () => {
    const light = '<p><span style="color:#ffffff">Light</span></p>';
    [
      '<td style="background: rgb(9, 48, 64) no-repeat !important">',
      '<td style="background:#ffffff;background:#093040">',
      '<td style="background-color: darkslategray">',
    ].forEach((cell) =>
      expect(richTextFindings(colorContrast, light, { cell })).toEqual([])
    );
  });

  it('accepts 3:1 for large text', () => {
    expect(
      richTextFindings(
        colorContrast,
        '<h1><span style="color:#888888;font-size:28px">Big title</span></h1>'
      )
    ).toEqual([]);
  });

  it('reads the size and weight the template gives the text', () => {
    const grey = '<p><span style="color:#888888">Big title</span></p>';
    expect(
      richTextFindings(colorContrast, grey, {
        cell: '<td style="font-size:30px;font-weight:bold">',
      })
    ).toEqual([]);
    expect(richTextFindings(colorContrast, grey)).toHaveLength(1);
  });

  it('takes no heading tag for bold text', () => {
    expect(
      richTextFindings(
        colorContrast,
        '<h2><span style="color:#888888;font-size:20px">Title</span></h2>'
      )
    ).toHaveLength(1);
  });

  it('reads the background of each copy of a text in its own column', () => {
    const text = '<p><span style="color:#dddddd">Read more</span></p>';
    const html = exportOf({
      b1: `<table><tr><td bgcolor="#ffffff">${text}</td><td bgcolor="#000000">${text}</td></tr></table>`,
    });
    const blocks = [
      { id: 'b1', type: 'twoColumns', leftText: text, rightText: text },
    ];
    const blockDefs = [
      {
        type: 'twoColumns',
        leftText: '<p>Left</p>',
        rightText: '<p>Right</p>',
      },
    ];
    const { findings } = runQualityChecks(
      fakeViewModel({ blocks, blockDefs, html }),
      {
        rules: [colorContrast],
      }
    );
    expect(findings.map((f) => f.propertyPath)).toEqual(['leftText']);
  });

  it("judges a background the client set under the template's text colour", () => {
    const [finding] = richTextFindings(
      colorContrast,
      '<p><span style="background-color:#444444">Dark card</span></p>',
      { cell: '<td style="color:#333333">' }
    );
    expect(finding).toMatchObject({ severity: 'error' });
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
    const blockDefs = [{ type: 'textBlock', longText: '<p>Sample</p>' }];
    expect(
      runQualityChecks(fakeViewModel({ blocks, blockDefs, html }), {
        rules: [colorContrast],
      }).findings
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

  it('reads the colour of the text around from the template', () => {
    const link =
      '<a href="#x" style="color:#333333;text-decoration:none">our terms</a>';
    const cell = '<td style="color:#333333">';
    expect(
      richTextFindings(indistinctLinks, `<p>Read ${link} first.</p>`, { cell })
    ).toHaveLength(1);
    // An inline editable is a paragraph of its own.
    expect(
      richTextFindings(indistinctLinks, `Read ${link} first.`, { cell })
    ).toHaveLength(1);
    expect(
      richTextFindings(indistinctLinks, `<p>Read ${link} first.</p>`, {
        cell: '<td style="color:#000000">',
      })
    ).toEqual([]);
  });

  it('leaves underlined links, coloured links and lone buttons alone', () => {
    const texts = [
      '<p style="color:#333">Read <a href="#x" style="color:#333">our terms</a> first.</p>',
      '<p style="color:#333">Read <a href="#x" style="color:#0055ff;text-decoration:none">our terms</a> first.</p>',
      '<p style="color:#333"><a href="#x" style="color:#333;text-decoration:none">Shop now</a></p>',
      // TinyMCE's "Underline" writes the line on a span inside the link.
      '<p style="color:#333">Read <a href="#x" style="color:#333;text-decoration:none"><span style="text-decoration:underline">our terms</span></a> first.</p>',
    ];
    texts.forEach((t) =>
      expect(richTextFindings(indistinctLinks, t)).toEqual([])
    );
  });
});
