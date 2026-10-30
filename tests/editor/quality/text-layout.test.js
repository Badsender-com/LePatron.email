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

const textLayout = require('../../../packages/editor/src/js/ext/quality/rules/text-layout');

const CENTRED =
  'Centred text over about three lines is hard to read: align long texts to the left';

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

  it('leaves comfortable text alone, a line height of 1 or 1.1 included', () => {
    expect(
      richTextFindings(
        textLayout,
        '<p style="line-height:150%;text-align:left">Fine</p><p style="line-height:1.1">Tight but fine</p><p style="line-height:1">Tight</p>'
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
      expect.objectContaining({ messageKey: CENTRED, blockId: null }),
    ]);
  });

  it('sums the centred paragraphs of a rich text, as TinyMCE centres each', () => {
    const paragraphs = (n, length) =>
      `<p style="text-align:center">${'a'.repeat(length)}</p>`.repeat(n);
    expect(richTextFindings(textLayout, paragraphs(4, 150))).toHaveLength(1);
    expect(richTextFindings(textLayout, paragraphs(2, 90))).toEqual([]);
  });

  it('measures only the text drawn centred', () => {
    const long = 'word '.repeat(50);
    expect(
      richTextFindings(
        textLayout,
        `<div style="text-align:center"><h2>Title</h2><p style="text-align:left">${long}</p></div>`
      )
    ).toEqual([]);
    expect(
      richTextFindings(
        textLayout,
        `<div style="text-align:center"><h2>Title</h2><p>${long}</p></div>`
      )
    ).toHaveLength(1);
  });

  it('counts a paragraph inside a centred container once', () => {
    const half = 'a'.repeat(110);
    expect(
      richTextFindings(
        textLayout,
        `<div style="text-align:center"><p style="text-align:center">${half}</p></div>`
      )
    ).toEqual([]);
  });

  it('notes centred text from 201 characters', () => {
    const centred = (n) =>
      richTextFindings(
        textLayout,
        `<p style="text-align:center">${'a'.repeat(n)}</p>`
      );
    expect(centred(200)).toEqual([]);
    expect(centred(201)).toHaveLength(1);
  });

  it('keeps one fingerprint for the centred advice, so ignoring it lasts', () => {
    const fingerprint = (text) =>
      richTextFindings(
        textLayout,
        `<p style="text-align:center">${text.repeat(60)}</p>`
      )[0].fingerprint;
    expect(fingerprint('abcd ')).toBe(fingerprint('wxyz '));
  });

  it("never judges the template's own centred text", () => {
    const longText = `<p style="text-align:center">${'word '.repeat(50)}</p>`;
    const html = exportOf({ b1: longText });
    const blocks = [{ id: 'b1', type: 'textBlock', longText }];
    const blockDefs = [{ type: 'textBlock', longText }];
    expect(
      runQualityChecks(fakeViewModel({ blocks, blockDefs, html }), {
        rules: [textLayout],
      }).findings
    ).toEqual([]);
  });

  it('judges a line height in px only against a font size declared in the text', () => {
    // The 12 px of a template footer is out of sight: 14px is not 0.875.
    expect(
      richTextFindings(textLayout, '<p style="line-height:14px">Legal</p>')
    ).toEqual([]);
    expect(
      richTextFindings(
        textLayout,
        '<p style="font-size:16px;line-height:0">Squashed</p>'
      )
    ).toHaveLength(1);
  });

  it('leaves short centred text alone', () => {
    expect(
      richTextFindings(textLayout, '<p style="text-align:center">Our offer</p>')
    ).toEqual([]);
  });
});
