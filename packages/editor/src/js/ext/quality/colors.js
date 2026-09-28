'use strict';

// Colours as written in inline styles and bgcolor attributes, and the WCAG
// contrast between two of them.

const NAMED = {
  black: '#000000',
  white: '#ffffff',
  red: '#ff0000',
  green: '#008000',
  blue: '#0000ff',
  yellow: '#ffff00',
  gray: '#808080',
  grey: '#808080',
  silver: '#c0c0c0',
  orange: '#ffa500',
  navy: '#000080',
  maroon: '#800000',
  purple: '#800080',
  teal: '#008080',
  lime: '#00ff00',
  aqua: '#00ffff',
  fuchsia: '#ff00ff',
  olive: '#808000',
};

/**
 * A colour as `#rrggbb`, or null when it is not an opaque colour we can read
 * (transparent, a semi-transparent rgba, a CSS variable…).
 */
function parseColor(value) {
  const text = String(value || '').trim().toLowerCase();
  if (NAMED[text]) return NAMED[text];
  let m = /^#([0-9a-f]{3})$/.exec(text);
  if (m) return `#${m[1].replace(/./g, (c) => c + c)}`;
  m = /^#([0-9a-f]{6})$/.exec(text);
  if (m) return `#${m[1]}`;
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/.exec(text);
  if (m && (m[4] === undefined || Number(m[4]) === 1)) {
    return `#${[m[1], m[2], m[3]]
      .map((n) => Math.min(255, Number(n)).toString(16).padStart(2, '0'))
      .join('')}`;
  }
  return null;
}

function luminance(hex) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// WCAG 2.x contrast ratio, from 1 to 21.
function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

// The value of one declaration of an inline style, or undefined.
function styleValue(el, prop) {
  const style = (el.getAttribute && el.getAttribute('style')) || '';
  const decl = style
    .split(';')
    .map((part) => part.split(':'))
    .find(([name]) => name && name.trim().toLowerCase() === prop);
  return decl ? decl.slice(1).join(':').trim() : undefined;
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
      parseColor(background.split(/\s+/).find((part) => parseColor(part))) ||
      parseColor(node.getAttribute('bgcolor'));
    if (color) return color;
  }
  return '#ffffff';
}

module.exports = { parseColor, contrastRatio, styleValue, backgroundOf };
