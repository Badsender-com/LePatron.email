/**
 * @jest-environment jsdom
 */

'use strict';

// The binding decides what markup reaches a DOM: neutralized in the canvas, an
// inert marker in the export frame. Anything else must fail CLOSED — no path is
// known to render the block elsewhere today, and one added later must not put
// raw pasted markup into the editor's own document by default.

const ko = require('knockout');
const createDOMPurify = require('dompurify');

window.DOMPurify = createDOMPurify(window);

require('../../../packages/editor/src/js/bindings/html-code-block.js');
// withProperties: how Mosaico puts `templateMode` in the binding context.
require('../../../packages/editor/src/js/bindings/blocks.js');
const {
  beginExportSubstitution,
  endExportSubstitution,
  substituteMarkers,
} = require('../../../packages/editor/src/js/ext/html-code-block/export-substitution.js');

const PASTED = '<p>kept</p><img src="x" onerror="window.pwned = 1">';

// `templateMode` travels in the binding context, set by withProperties as in
// the editor's own templates.
function render(templateMode) {
  const host = document.createElement('div');
  host.innerHTML =
    `<div data-bind="withProperties: { templateMode: '${templateMode}' }">` +
    '<div data-bind="lpHtmlCode: htmlCode"></div></div>';
  document.body.appendChild(host);
  ko.applyBindings({ htmlCode: PASTED }, host);
  return host.querySelector('[data-bind^="lpHtmlCode"]');
}

afterEach(() => {
  endExportSubstitution();
  delete window.pwned;
  document.body.innerHTML = '';
});

describe('lpHtmlCode binding', () => {
  it('neutralizes the markup in the canvas', () => {
    const element = render('wysiwyg');
    expect(element.innerHTML).toContain('<p>kept</p>');
    expect(element.innerHTML).not.toMatch(/onerror/);
  });

  it('renders a marker during an export, swapped back for the raw bytes', () => {
    beginExportSubstitution();
    const element = render('show');
    expect(element.innerHTML).not.toContain('<p>');
    expect(substituteMarkers(element.innerHTML)).toBe(PASTED);
  });

  it('neutralizes the markup anywhere else, instead of rendering it raw', () => {
    const element = render('show');
    expect(element.innerHTML).toContain('<p>kept</p>');
    expect(element.innerHTML).not.toMatch(/onerror/);
  });
});
