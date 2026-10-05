'use strict';

// The Tailwind configuration the block builder's components are compiled with.
//
// Tailwind's defaults are written for browsers, and much of what they emit is
// dropped by email clients: `rem` units, custom properties (`--tw-*`, and
// `rgb(… / var(--tw-text-opacity))` for every colour), `text-decoration-line`,
// which the older Outlook builds ignore. This is the email-safe subset, on the
// model of tailwindcss-preset-email (Maizzle's preset for Tailwind 3), written
// out here rather than added as a dependency: the preset also pulls variant
// plugins this build cannot use, since responsive and client-targeting classes
// need a stylesheet in the document head.
//
// What this config does not make safe, the build refuses: see
// email-safe-css.js.

const defaultTheme = require('tailwindcss/defaultTheme');
const plugin = require('tailwindcss/plugin');

const REM = /(-?\d*\.?\d+)rem\b/g;
const toPx = (value) => value.replace(REM, (_, rem) => `${Number(rem) * 16}px`);

/**
 * The same theme with every `rem` in pixels — the spacing scale, the type
 * scale and its line heights, the radii, the max widths.
 *
 * Function entries (`padding: ({ theme }) => theme('spacing')`) are wrapped
 * rather than called, so they still resolve against the converted theme.
 */
function remToPx(value) {
  if (typeof value === 'string') return toPx(value);
  if (typeof value === 'function') return (...args) => remToPx(value(...args));
  if (Array.isArray(value)) return value.map(remToPx);
  if (value && typeof value === 'object') {
    return Object.keys(value).reduce((converted, key) => {
      converted[key] = remToPx(value[key]);
      return converted;
    }, {});
  }
  return value;
}

// The shorthand works everywhere; the longhand Tailwind emits does not.
const textDecoration = plugin(({ addUtilities }) => {
  addUtilities({
    '.underline': { 'text-decoration': 'underline' },
    '.overline': { 'text-decoration': 'overline' },
    '.line-through': { 'text-decoration': 'line-through' },
    '.no-underline': { 'text-decoration': 'none' },
  });
});

module.exports = {
  theme: remToPx(defaultTheme),
  corePlugins: {
    preflight: false,
    // With these on, every colour is `rgb(r g b / var(--tw-…-opacity))`. Off,
    // it is the theme's hex value.
    backgroundOpacity: false,
    borderOpacity: false,
    divideOpacity: false,
    placeholderOpacity: false,
    ringOpacity: false,
    textOpacity: false,
    // Replaced by the shorthand above.
    textDecoration: false,
  },
  plugins: [textDecoration],
};
