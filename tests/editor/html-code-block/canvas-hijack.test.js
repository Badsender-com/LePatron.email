/**
 * @jest-environment jsdom
 */

'use strict';

// EXPLOIT TEST — the canvas preview is the editor's own document.
//
// The canvas renders the pasted markup through DOMPurify, which strips scripts
// and event handlers. It used to keep `id` and `data-*` attributes, and that was
// enough: the editor finds its own nodes by id (the export frame, the Knockout
// templates, the download form), getElementById returns the FIRST match, and
// the canvas comes first in the document. A pasted element named `exportframe`
// was bound by `ko.applyBindings(viewModel, frameEl)` on the next save, and
// Knockout evaluated the pasted `data-bind` attributes as JavaScript with the
// session of whoever saved.
//
// This runs the real chain — DOMPurify with the canvas configuration, then
// Knockout — rather than asserting on the sanitizer output alone.

const ko = require('knockout');
const createDOMPurify = require('dompurify');
const {
  neutralizeHtmlForPreview,
} = require('../../../packages/editor/src/js/ext/html-code-block/neutralize-html.js');

const purifier = createDOMPurify(window);
const neutralize = (html) => neutralizeHtmlForPreview(html, purifier);

// The editor's layout: the canvas first, the export frame appended after it.
function renderCanvas(pasted) {
  document.body.innerHTML =
    '<div id="page"><div id="main-wysiwyg-area">' +
    `<div class="lp-html-block">${neutralize(pasted)}</div>` +
    '</div></div>';
}

afterEach(() => {
  delete window.pwned;
  document.body.innerHTML = '';
});

describe('EXPLOIT — pasted markup standing in for an editor node', () => {
  const hijack =
    '<div id="exportframe"><span data-bind="text: (window.pwned = 1)"></span></div>';

  it('no pasted element can be found under an id the editor looks up', () => {
    renderCanvas(hijack);

    expect(document.getElementById('exportframe')).toBeNull();
    expect(document.getElementById('user-content-exportframe')).not.toBeNull();
  });

  it('binding the pasted markup runs nothing', () => {
    renderCanvas(hijack);

    // What exportHTML did with the element it found: bind the view-model on it.
    ko.applyBindings({}, document.getElementById('main-wysiwyg-area'));

    expect(window.pwned).toBeUndefined();
    expect(document.querySelector('[data-bind]')).toBeNull();
  });

  // The Knockout templates are <script type="text/html" id="..."> looked up by
  // id too (bindings/script-template.js): same collision, same fix.
  it('a pasted id cannot shadow a Knockout template either', () => {
    renderCanvas('<div id="block-wysiwyg">x</div>');
    expect(document.getElementById('block-wysiwyg')).toBeNull();
  });

  it.each([
    ['data-bind', '<p data-bind="text: 1">x</p>'],
    ['any data-* attribute', '<p data-ko-block="text">x</p>'],
  ])('drops %s', (_label, html) => {
    expect(neutralize(html)).not.toMatch(/data-/);
  });

  it('prefixes name as well as id', () => {
    const html = neutralize('<a name="downloadForm" id="x">a</a>');
    expect(html).toContain('name="user-content-downloadForm"');
    expect(html).toContain('id="user-content-x"');
  });
});
