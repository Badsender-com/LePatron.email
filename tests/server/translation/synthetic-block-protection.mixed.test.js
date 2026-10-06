'use strict';

// A mailing holding both synthetic blocks, translated.
//
// synthetic-block-protection.test.js covers the zones with the HTML code
// block's marker; this is the mailing a client with both flags actually has —
// pasted markup and a composed block side by side, each sharing wording with a
// native block. Every zone must come out of the string replacement untouched,
// paired with its own stored markup, whatever the order of the two types.

jest.mock('../../../packages/server/utils/logger.js', () => ({
  warn: jest.fn(),
  log: jest.fn(),
  error: jest.fn(),
}));

const {
  updatePreviewWithTranslations,
} = require('../../../packages/server/translation/preview-html-updater');
const {
  findHtmlCodeBlockRanges,
} = require('../../../packages/server/translation/synthetic-block-protection.js');
const {
  findSyntheticBlocks,
  htmlOf,
} = require('../../../packages/server/mailing/synthetic-block-guard.js');

// An extra `</div>` in the pasted markup: depth counting alone would close the
// zone too early, so only an exact match on the stored markup protects it.
const PASTED = '<table><tr><td>Hello world</td></tr></table></div>';
const COMPOSED =
  '<table role="presentation"><tr><td><p>Hello world</p></td></tr></table>';

const data = {
  mainBlocks: {
    blocks: [
      { type: 'textBlock', text: 'Hello world' },
      { type: 'blockBuilderBlock', builderHtml: COMPOSED, builderState: '{}' },
      { type: 'htmlCodeBlock', htmlCode: PASTED },
    ],
  },
};

const zone = (rootClass, markerClass, inner) =>
  `<div class="${rootClass}"><div class="${markerClass}">${inner}</div></div>`;

const previewHtml = [
  '<html><body>',
  '<table class="vb-outer"><tr><td>Hello world</td></tr></table>',
  zone('lp-builder-block-root', 'lp-builder-block', COMPOSED),
  zone('lp-html-block-root', 'lp-html-block', PASTED),
  '<table class="vb-outer"><tr><td>Hello world</td></tr></table>',
  '</body></html>',
].join('');

// What the translation controller hands the protection: every synthetic
// block's markup, in document order, read with the guard's own helper.
const htmlCodes = findSyntheticBlocks(data).map(htmlOf);

describe('a mailing with both synthetic blocks', () => {
  it('lists the markup of both types, in document order', () => {
    expect(htmlCodes).toEqual([COMPOSED, PASTED]);
  });

  it('finds one zone per block, each ending where its markup does', () => {
    const ranges = findHtmlCodeBlockRanges(previewHtml, htmlCodes);

    expect(ranges).toHaveLength(2);
    expect(previewHtml.slice(ranges[0].start, ranges[0].end)).toBe(
      `<div class="lp-builder-block">${COMPOSED}</div>`
    );
    expect(previewHtml.slice(ranges[1].start, ranges[1].end)).toBe(
      `<div class="lp-html-block">${PASTED}</div>`
    );
  });

  it('translates the native blocks and leaves both zones byte-identical', () => {
    const result = updatePreviewWithTranslations(
      previewHtml,
      { k: 'Hello world' },
      { k: 'Bonjour le monde' },
      { htmlCodes }
    );

    expect(result).toContain(
      '<table class="vb-outer"><tr><td>Bonjour le monde</td></tr></table>'
    );
    expect(result).not.toContain(
      '<table class="vb-outer"><tr><td>Hello world</td></tr></table>'
    );
    expect(result).toContain(`<div class="lp-builder-block">${COMPOSED}</div>`);
    expect(result).toContain(`<div class="lp-html-block">${PASTED}</div>`);
  });

  // The order in the list follows the data; the protection must not depend
  // on the two types coming in a particular order.
  it('holds when the HTML code block comes first', () => {
    const swapped = previewHtml
      .replace(zone('lp-builder-block-root', 'lp-builder-block', COMPOSED), 'Z')
      .replace(
        zone('lp-html-block-root', 'lp-html-block', PASTED),
        zone('lp-builder-block-root', 'lp-builder-block', COMPOSED)
      )
      .replace('Z', zone('lp-html-block-root', 'lp-html-block', PASTED));

    const result = updatePreviewWithTranslations(
      swapped,
      { k: 'Hello world' },
      { k: 'Bonjour le monde' },
      { htmlCodes: [PASTED, COMPOSED] }
    );

    expect(result).toContain(`<div class="lp-html-block">${PASTED}</div>`);
    expect(result).toContain(`<div class="lp-builder-block">${COMPOSED}</div>`);
  });
});
