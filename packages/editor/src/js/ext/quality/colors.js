'use strict';

// Colours as written in inline styles and bgcolor attributes, and the WCAG
// contrast between two of them.

const CSS_NAMED_COLORS = require('./css-named-colors');
const { styleValue } = require('./inline-style');

const expand = (short) => short.replace(/./g, (c) => c + c);

/**
 * A colour as `#rrggbb`, or null when it is not an opaque colour we can read
 * (transparent, a semi-transparent rgba, a CSS variable…).
 */
function parseColor(value) {
  const text = String(value || '')
    .trim()
    .toLowerCase();
  if (CSS_NAMED_COLORS[text]) return CSS_NAMED_COLORS[text];
  // #rgb, #rgba and #rrggbbaa, opaque only.
  let m = /^#([0-9a-f]{3})(f)?$/.exec(text);
  if (m) return `#${expand(m[1])}`;
  m = /^#([0-9a-f]{6})(ff)?$/.exec(text);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(
    text
  );
  if (m && (m[4] === undefined || Number(m[4]) === 1)) {
    return `#${[m[1], m[2], m[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return null;
}

// What may be a colour in a `background` shorthand: `rgb(9, 48, 64)` carries
// spaces, so the shorthand is not split on them.
const COLOR_TOKEN = /rgba?\([^)]*\)|#[0-9a-f]{3,8}|[a-z]+/gi;

// The colour of a `background` shorthand, or null.
function shorthandColor(background) {
  const tokens = String(background || '').match(COLOR_TOKEN) || [];
  return tokens.map(parseColor).find(Boolean) || null;
}

// WCAG 2.1 relative luminance (sRGB threshold 0.04045).
function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.x contrast ratio, from 1 to 21.
function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * The background an element's text is drawn on, walking up the export: its
 * own or its nearest ancestor's background colour. Null when an image is
 * behind (nothing can be said), white when nothing is declared (clients show
 * emails on white).
 */
function backgroundOf(el) {
  for (let node = el; node && node.nodeType === 1; node = node.parentElement) {
    const background = styleValue(node, 'background') || '';
    const image = styleValue(node, 'background-image');
    if (/url\(/i.test(background) || (image && image !== 'none')) return null;
    if (node.getAttribute('background')) return null;
    const color =
      parseColor(styleValue(node, 'background-color')) ||
      shorthandColor(background) ||
      parseColor(node.getAttribute('bgcolor'));
    if (color) return color;
  }
  return '#ffffff';
}

module.exports = { parseColor, shorthandColor, contrastRatio, backgroundOf };
