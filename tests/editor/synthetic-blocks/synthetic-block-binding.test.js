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

require('../../../packages/editor/src/js/bindings/synthetic-block.js');
// withProperties: how Mosaico puts `templateMode` in the binding context.
require('../../../packages/editor/src/js/bindings/blocks.js');
const {
  beginExportSubstitution,
  endExportSubstitution,
  substituteMarkers,
} = require('../../../packages/editor/src/js/ext/synthetic-blocks/export-substitution.js');

const PASTED = '<p>kept</p><img src="x" onerror="window.pwned = 1">';

// `templateMode` travels in the binding context, set by withProperties as in
// the editor's own templates.
function render(templateMode) {
  const host = document.createElement('div');
  host.innerHTML =
    `<div data-bind="withProperties: { templateMode: '${templateMode}' }">` +
    '<div data-bind="lpSyntheticBlock: htmlCode"></div></div>';
  document.body.appendChild(host);
  ko.applyBindings({ htmlCode: PASTED }, host);
  return host.querySelector('[data-bind^="lpSyntheticBlock"]');
}

afterEach(() => {
  endExportSubstitution();
  delete window.pwned;
  document.body.innerHTML = '';
});

describe('lpSyntheticBlock binding', () => {
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

// A link in the canvas is not followed: a composed button with no URL yet is
// `href="#"`, and a click opened the editor again in another tab. The click
// still bubbles, so the block is selected by it.
describe('links in the canvas', () => {
  const clickOn = (target, type = 'click') => {
    const event = new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      button: type === 'auxclick' ? 1 : 0,
    });
    target.dispatchEvent(event);
    return event;
  };

  function renderLink(templateMode) {
    const host = document.createElement('div');
    host.innerHTML =
      `<div data-bind="withProperties: { templateMode: '${templateMode}' }">` +
      '<div data-bind="lpSyntheticBlock: htmlCode"></div></div>';
    document.body.appendChild(host);
    ko.applyBindings(
      { htmlCode: '<a href="#" target="_blank"><span>Bouton</span></a>' },
      host
    );
    return host;
  }

  it('cancels a click on a link, inner element included', () => {
    const host = renderLink('wysiwyg');
    const bubbled = jest.fn();
    host.addEventListener('click', bubbled);

    const event = clickOn(host.querySelector('span'));

    expect(event.defaultPrevented).toBe(true);
    expect(bubbled).toHaveBeenCalled();
  });

  // A middle click opens the link in a new tab without any `click`.
  it('cancels a middle click on a link too, and lets it bubble', () => {
    const host = renderLink('wysiwyg');
    const bubbled = jest.fn();
    host.addEventListener('auxclick', bubbled);

    const event = clickOn(host.querySelector('span'), 'auxclick');

    expect(event.defaultPrevented).toBe(true);
    expect(bubbled).toHaveBeenCalled();
  });

  it('leaves a click outside any link alone', () => {
    const host = renderLink('wysiwyg');
    const element = host.querySelector('[data-bind^="lpSyntheticBlock"]');

    expect(clickOn(element).defaultPrevented).toBe(false);
    expect(clickOn(element, 'auxclick').defaultPrevented).toBe(false);
  });
});
