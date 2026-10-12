/**
 * @jest-environment jsdom
 */

'use strict';

// The preview's own chrome holds to WCAG AA on its white page
// (docs/UX_GUIDELINES.md): 4.5:1 for text, 3:1 for a line or an outline that
// says something. The first version used the accent #00acdc for the insertion
// line and the live drop zone (2.65:1), and greys down to 2.05:1 for the
// outlines — all of it readable on a good screen and gone on a poor one.

const { openModal, DROP_LINE_ID, EMPTY_DROP_ID } = require('./drag-helpers.js');

afterEach(() => {
  document.body.innerHTML = '';
});

const luminance = (hex) => {
  const channels = [1, 3, 5].map((at) => {
    const value = parseInt(hex.slice(at, at + 2), 16) / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

const contrastOnWhite = (hex) => 1.05 / (luminance(hex) + 0.05);

/** The colour a rule gives a property, read off the preview's stylesheet. */
function colourOf(css, selector, property) {
  const at = css.indexOf(`${selector}{`);
  expect(at).toBeGreaterThan(-1);
  const rule = css.slice(at, css.indexOf('}', at));
  const match = rule.match(
    new RegExp(`[{;]${property}:[^;]*?(#[0-9a-f]{6})`, 'i')
  );
  expect(match).not.toBeNull();
  return match[1];
}

describe('the preview chrome is legible', () => {
  let css;
  beforeAll(async () => {
    const { doc } = await openModal([]);
    css = doc.querySelector('style').textContent;
  });

  it.each([
    ['the insertion line', `#${DROP_LINE_ID}`, 'background'],
    ['the row outlines during a drag', 'lp-bb-selected)', 'outline'],
    ['the empty zone border', `#${EMPTY_DROP_ID}`, 'border'],
  ])('%s reaches 3:1', (name, selector, property) => {
    expect(
      contrastOnWhite(colourOf(css, selector, property))
    ).toBeGreaterThanOrEqual(3);
  });

  it.each([
    ['at rest', `#${EMPTY_DROP_ID}`],
    ['during a drag', `lp-bb-dragging #${EMPTY_DROP_ID}`],
  ])('the empty zone text reaches 4.5:1 %s', (name, selector) => {
    expect(
      contrastOnWhite(colourOf(css, selector, 'color'))
    ).toBeGreaterThanOrEqual(4.5);
  });
});
