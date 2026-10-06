/**
 * @jest-environment jsdom
 */

'use strict';

// The composed block rides on the HTML code block's machinery — the empty-block
// strip, the inliner protection, the export substitution — driven off the
// descriptor table rather than written twice. Those modules' own tests use the
// HTML code block's classes; these run the same mechanics with the BUILDER's,
// and with both blocks in one mail, so a descriptor the machinery stopped
// reading would fail here rather than in a client's inbox.

const jQuery = require('jquery');
const ko = require('knockout');
const createDOMPurify = require('dompurify');

global.$ = global.jQuery = jQuery;
global.ko = ko;
window.DOMPurify = createDOMPurify(window);

require('../../../packages/editor/src/js/bindings/synthetic-block.js');
require('../../../packages/editor/src/js/bindings/blocks.js');
const {
  stripEmptySyntheticBlocks,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/strip-empty-blocks.js');
const {
  detachPastedMarkup,
  restorePastedMarkup,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/protect-from-inliner.js');
const {
  beginExportSubstitution,
  endExportSubstitution,
  substituteMarkers,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/export-substitution.js');
const {
  BLOCK_BUILDER_BLOCK,
  HTML_CODE_BLOCK,
} = require('../../../packages/shared/synthetic-blocks.js');
const {
  generate,
} = require('../../../packages/shared/block-builder/generate.js');

const COMPOSED = generate({
  elements: [{ id: 'a', type: 'text', content: 'Bonjour <b>à tous</b>' }],
});
const PASTED =
  '<table width="600"><tr><td style="color:red">x</td></tr></table>';

const root = (descriptor, inner) =>
  `<div class="${descriptor.rootClass}" id="ko_${descriptor.type}_1">${inner}</div>`;
const marker = (descriptor, inner) =>
  `<div class="${descriptor.markerClass}">${inner}</div>`;

afterEach(() => {
  endExportSubstitution();
  document.body.innerHTML = '';
});

describe('the empty-block strip, on a composed block', () => {
  it('removes the root of an empty composed block', () => {
    const html = `<p>a</p>${root(BLOCK_BUILDER_BLOCK, '')}<p>b</p>`;

    expect(stripEmptySyntheticBlocks(html)).toBe('<p>a</p><p>b</p>');
  });

  it('leaves a composed block with markup alone', () => {
    const html = root(
      BLOCK_BUILDER_BLOCK,
      marker(BLOCK_BUILDER_BLOCK, COMPOSED)
    );

    expect(stripEmptySyntheticBlocks(html)).toBe(html);
  });

  it('strips each empty block, of either type, in one mail', () => {
    const kept = root(
      BLOCK_BUILDER_BLOCK,
      marker(BLOCK_BUILDER_BLOCK, COMPOSED)
    );
    const html =
      root(HTML_CODE_BLOCK, '') + kept + root(BLOCK_BUILDER_BLOCK, '\n  ');

    expect(stripEmptySyntheticBlocks(html)).toBe(kept);
  });
});

describe('the inliner protection, on a composed block', () => {
  it('detaches the composed markup and puts it back untouched', () => {
    document.body.innerHTML = marker(BLOCK_BUILDER_BLOCK, COMPOSED);
    const holder = () =>
      document.querySelector(`.${BLOCK_BUILDER_BLOCK.markerClass}`);
    const before = holder().innerHTML;

    const detached = detachPastedMarkup(jQuery, document);
    expect(holder().innerHTML).toBe('');

    restorePastedMarkup(detached);
    expect(holder().innerHTML).toBe(before);
  });

  it('protects both blocks of a mixed mail, each in its place', () => {
    document.body.innerHTML =
      marker(HTML_CODE_BLOCK, PASTED) +
      '<p style="x">native</p>' +
      marker(BLOCK_BUILDER_BLOCK, COMPOSED);
    const before = document.body.innerHTML;

    const detached = detachPastedMarkup(jQuery, document);
    expect(detached).toHaveLength(2);
    expect(document.querySelectorAll('td')).toHaveLength(0);

    restorePastedMarkup(detached);
    expect(document.body.innerHTML).toBe(before);
  });
});

describe('the export substitution, on a composed block', () => {
  // `templateMode` travels in the binding context, as in the editor's own
  // templates; `show` is the export frame.
  function renderShow(model) {
    const host = document.createElement('div');
    host.innerHTML =
      '<div data-bind="withProperties: { templateMode: \'show\' }">' +
      '<div data-bind="lpSyntheticBlock: htmlCode"></div>' +
      '<div data-bind="lpSyntheticBlock: builderHtml"></div></div>';
    document.body.appendChild(host);
    ko.applyBindings(model, host);
    return host;
  }

  it('swaps the composed markup back byte for byte', () => {
    beginExportSubstitution();
    const host = renderShow({ htmlCode: PASTED, builderHtml: COMPOSED });

    expect(host.innerHTML).not.toContain('Bonjour');

    const exported = substituteMarkers(host.innerHTML);
    expect(exported).toContain(COMPOSED);
    expect(exported).toContain(PASTED);
    // Pasted markup first, composed second: each marker gets its own bytes.
    expect(exported.indexOf(PASTED)).toBeLessThan(exported.indexOf(COMPOSED));
  });
});
