'use strict';

// Putting a rebuilt composed block back into previewHtml.
//
// The preview is translated by replacing strings, and a composed block's
// markup is protected from that pass — it is generated. Replacing the zone's
// content wholesale is the only way it ever changes language, so which zone
// gets replaced is the whole question.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  swapBuilderMarkup,
} = require('../../../packages/server/translation/builder-preview-swap.js');

// The zones as the editor export writes them (inject-synthetic-blocks.js).
const composed = (inner) =>
  `<div class="lp-builder-block-root"><div class="lp-builder-block">${inner}</div></div>`;
const pasted = (inner) =>
  `<div class="lp-html-block-root"><div class="lp-html-block">${inner}</div></div>`;

const BONJOUR = '<table role="presentation"><tr><td>Bonjour</td></tr></table>';
const HELLO = '<table role="presentation"><tr><td>Hello</td></tr></table>';

describe('swapping the rebuilt markup into the preview', () => {
  it('replaces the block markup and leaves the rest alone', () => {
    const html = `<body>avant${composed(BONJOUR)}apres</body>`;

    expect(swapBuilderMarkup(html, [BONJOUR], [HELLO])).toBe(
      `<body>avant${composed(HELLO)}apres</body>`
    );
  });

  // Searching the document for the old markup found the copy first.
  it('leaves alone a copy of the block pasted into an HTML code block before it', () => {
    const copy = `<p>Copie :</p>${BONJOUR}`;
    const html = `<body>${pasted(copy)}${composed(BONJOUR)}</body>`;

    expect(swapBuilderMarkup(html, [copy, BONJOUR], [copy, HELLO])).toBe(
      `<body>${pasted(copy)}${composed(HELLO)}</body>`
    );
  });

  // The first block did not change. Skipping it without consuming its zone
  // sent the second block's swap to the first zone.
  it('swaps only the second of two identical blocks when only it changed', () => {
    const html = `${composed(BONJOUR)}<hr>${composed(BONJOUR)}`;

    expect(swapBuilderMarkup(html, [BONJOUR, BONJOUR], [BONJOUR, HELLO])).toBe(
      `${composed(BONJOUR)}<hr>${composed(HELLO)}`
    );
  });

  it('swaps two identical blocks in order', () => {
    const one = '<table><tr><td>1</td></tr></table>';
    const two = '<table><tr><td>2</td></tr></table>';
    const html = `${composed(BONJOUR)}x${composed(BONJOUR)}`;

    expect(swapBuilderMarkup(html, [BONJOUR, BONJOUR], [one, two])).toBe(
      `${composed(one)}x${composed(two)}`
    );
  });

  // The model lists its containers in one order, the template renders them in
  // another: a forward-only search never came back for the block rendered
  // first.
  it('finds a block whose container renders before the one stored first', () => {
    const footer = '<table><tr><td>Pied</td></tr></table>';
    const footerEn = '<table><tr><td>Footer</td></tr></table>';
    // Stored order: footerBlocks, then mainBlocks. Rendered: main first.
    const html = `${composed(BONJOUR)}<hr>${composed(footer)}`;

    expect(swapBuilderMarkup(html, [footer, BONJOUR], [footerEn, HELLO])).toBe(
      `${composed(HELLO)}<hr>${composed(footerEn)}`
    );
  });

  // Only the builder's zones are rewritten, whatever the lists say.
  it('never rewrites an HTML code block zone', () => {
    const html = pasted(BONJOUR);

    expect(swapBuilderMarkup(html, [BONJOUR], [HELLO])).toBe(html);
  });

  // A preview that keeps one block in the old language is visible and
  // recoverable; rewriting the wrong range would not be.
  it('leaves the document alone when a zone cannot be found', () => {
    const html = '<body>rien a voir</body>';

    expect(swapBuilderMarkup(html, [BONJOUR], [HELLO])).toBe(html);
  });

  it('does nothing when the markup did not change', () => {
    const html = `<body>${composed(BONJOUR)}</body>`;

    expect(swapBuilderMarkup(html, [BONJOUR], [BONJOUR])).toBe(html);
  });

  test.each([
    ['no html', undefined],
    ['an empty document', ''],
  ])('tolerates %s', (_label, html) => {
    expect(swapBuilderMarkup(html, ['a'], ['b'])).toBe(html);
  });
});
