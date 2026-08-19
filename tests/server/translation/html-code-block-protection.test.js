'use strict';

const {
  updatePreviewWithTranslations,
} = require('../../../packages/server/translation/preview-html-updater');
const {
  findHtmlCodeBlockRanges,
  transformOutsideHtmlCodeBlocks,
} = require('../../../packages/server/translation/html-code-block-protection.js');

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

// previewHtml as the editor produces it: a native block, then an HTML code block
// whose markup was substituted back byte-for-byte.
const buildPreview = (nativeText, pastedHtml) =>
  [
    '<html><body>',
    `<table class="vb-outer"><tr><td>${nativeText}</td></tr></table>`,
    '<div class="lp-html-block-root" id="ko_htmlCodeBlock_3">',
    `<div class="lp-html-block">${pastedHtml}</div>`,
    '</div>',
    `<table class="vb-outer"><tr><td>${nativeText}</td></tr></table>`,
    '</body></html>',
  ].join('');

describe('HTML code block protection in previewHtml translation', () => {
  // The bug: the pasted markup shares wording with a native block, so the blind
  // string replacement rewrote it inside the block too — previewHtml (preview,
  // multi-mailing ZIP) then diverged from the editor export, rebuilt from `data`.
  it('translates the native block but leaves the pasted markup byte-identical', () => {
    const pasted =
      '<table align="center"><tr><td>Hello world</td></tr></table>';
    const previewHtml = buildPreview('Hello world', pasted);

    const result = updatePreviewWithTranslations(
      previewHtml,
      { 'data.block.text': 'Hello world' },
      { 'data.block.text': 'Bonjour le monde' }
    );

    // Native blocks are translated...
    expect(result).toContain(
      '<table class="vb-outer"><tr><td>Bonjour le monde</td></tr></table>'
    );
    // ...and the block's markup comes out exactly as stored in htmlCode.
    expect(result).toContain(`<div class="lp-html-block">${pasted}</div>`);
    expect(result).not.toContain(
      '<table align="center"><tr><td>Bonjour le monde</td></tr></table>'
    );
  });

  it('translates both native blocks surrounding the HTML block', () => {
    const result = updatePreviewWithTranslations(
      buildPreview('Hello', '<b>Hello</b>'),
      { k: 'Hello' },
      { k: 'Bonjour' }
    );
    expect(result.match(/Bonjour/g)).toHaveLength(2);
    expect(result).toContain('<div class="lp-html-block"><b>Hello</b></div>');
  });

  it('protects an ESP tag inside the block that also appears outside', () => {
    const pasted = '<td><%@ include view=\'CLAAUT_unsubLink\' %></td>';
    const result = updatePreviewWithTranslations(
      buildPreview('Unsubscribe', pasted),
      { k: 'Unsubscribe' },
      { k: 'Se désabonner' }
    );
    expect(result).toContain(`<div class="lp-html-block">${pasted}</div>`);
    expect(result).toContain('Se désabonner');
  });

  it('handles a mailing with no HTML code block exactly as before', () => {
    const html = '<td>Hello</td><td>Hello</td>';
    expect(
      updatePreviewWithTranslations(html, { k: 'Hello' }, { k: 'Bonjour' })
    ).toBe('<td>Bonjour</td><td>Bonjour</td>');
  });

  it('protects several HTML blocks independently', () => {
    const html =
      '<td>Hello</td>' +
      '<div class="lp-html-block">Hello A</div>' +
      '<td>Hello</td>' +
      '<div class="lp-html-block">Hello B</div>' +
      '<td>Hello</td>';
    const result = updatePreviewWithTranslations(
      html,
      { k: 'Hello' },
      { k: 'Bonjour' }
    );
    expect(result).toContain('<div class="lp-html-block">Hello A</div>');
    expect(result).toContain('<div class="lp-html-block">Hello B</div>');
    expect(result.match(/<td>Bonjour<\/td>/g)).toHaveLength(3);
  });

  it('also protects the encoded second pass', () => {
    // Pass 2 works on entity-encoded text (attribute values).
    const pasted = '<img alt="A &amp; B">';
    const result = updatePreviewWithTranslations(
      `<td alt="A &amp; B"></td><div class="lp-html-block">${pasted}</div>`,
      { k: 'A & B' },
      { k: 'C & D' }
    );
    expect(result).toContain(`<div class="lp-html-block">${pasted}</div>`);
    expect(result).toContain('<td alt="C &amp; D"></td>');
  });
});

describe('findHtmlCodeBlockRanges', () => {
  it('covers the marker element and its content', () => {
    const html = 'before<div class="lp-html-block">x</div>after';
    const [range] = findHtmlCodeBlockRanges(html);
    expect(html.slice(range.start, range.end)).toBe(
      '<div class="lp-html-block">x</div>'
    );
  });

  it('counts nested divs so the zone ends at the right closing tag', () => {
    const inner = '<div><div>deep</div></div>';
    const html = `a<div class="lp-html-block">${inner}</div>b`;
    const [range] = findHtmlCodeBlockRanges(html);
    expect(html.slice(range.start, range.end)).toBe(
      `<div class="lp-html-block">${inner}</div>`
    );
  });

  // A conditional comment routinely holds an unbalanced <div> for Outlook.
  it('ignores divs inside HTML comments', () => {
    const inner =
      '<!--[if mso]><div><![endif]-->kept<!--[if mso]></div><![endif]-->';
    const html = `a<div class="lp-html-block">${inner}</div>b`;
    const [range] = findHtmlCodeBlockRanges(html);
    expect(html.slice(range.start, range.end)).toBe(
      `<div class="lp-html-block">${inner}</div>`
    );
  });

  it('does not match the block root class', () => {
    expect(
      findHtmlCodeBlockRanges('<div class="lp-html-block-root">x</div>')
    ).toEqual([]);
  });

  it('does not match a class that merely contains the name', () => {
    expect(
      findHtmlCodeBlockRanges('<div class="not-lp-html-block-either">x</div>')
    ).toEqual([]);
  });

  it('matches when other classes sit alongside', () => {
    const html = '<div class="a lp-html-block b">x</div>';
    expect(findHtmlCodeBlockRanges(html)).toHaveLength(1);
  });

  // Fail safe, not fail open: better an untranslated tail than corrupted markup.
  it('protects to the end of the document when the markup is unbalanced', () => {
    const html = 'a<div class="lp-html-block"><div>oops</div>tail';
    const [range] = findHtmlCodeBlockRanges(html);
    expect(range.end).toBe(html.length);
  });

  it('returns nothing for empty or non-string input', () => {
    expect(findHtmlCodeBlockRanges('')).toEqual([]);
    expect(findHtmlCodeBlockRanges(null)).toEqual([]);
  });
});

describe('transformOutsideHtmlCodeBlocks', () => {
  const shout = (s) => s.toUpperCase();

  it('transforms everything when there is no block', () => {
    expect(transformOutsideHtmlCodeBlocks('abc', shout)).toBe('ABC');
  });

  it('skips the block zone only', () => {
    expect(
      transformOutsideHtmlCodeBlocks(
        'a<div class="lp-html-block">keep</div>b',
        shout
      )
    ).toBe('A<div class="lp-html-block">keep</div>B');
  });

  it('passes through empty and non-string input', () => {
    expect(transformOutsideHtmlCodeBlocks('', shout)).toBe('');
    expect(transformOutsideHtmlCodeBlocks(null, shout)).toBeNull();
  });
});
