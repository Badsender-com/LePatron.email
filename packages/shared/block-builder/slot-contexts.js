'use strict';

// Escaping for the block builder's generated markup, driven by WHERE a value
// lands rather than by the developer remembering to escape.
//
// This is the whole security model of the generator. The POC of March 2026
// built its HTML with template literals and a helper the author had to call —
// and the XSS it shipped (docs/plans/wysiwyg-block-builder-review.md, §3) came
// from exactly one forgotten call. Here a slot declares its context once, in
// the template, and a value cannot reach the output without going through it.
//
// Values arrive already resolved: a colour, a size, a label. Whether they came
// from a free input or from a template token is the caller's business — the
// generator knows nothing about themes.

const {
  asString,
  escapeText,
  escapeAttribute,
  isSafeUrl,
} = require('./escape-primitives.js');
const { sanitizeRichText } = require('./rich-text.js');

const TEXT = 'TEXT';
const ATTR = 'ATTR';
const URL = 'URL';
const COLOR = 'COLOR';
const PX = 'PX';
const CSS_VALUE = 'CSS_VALUE';
// The only context that lets USER markup through, and the only one backed by an
// allow-list rather than an escape. See rich-text.js.
const RICH_TEXT = 'RICH_TEXT';

// Markup the GENERATOR produced, inserted as it was built.
//
// The one context that does not escape at all, so the one that could undo the
// whole model. It exists because a layout has to contain the rendered HTML of
// its columns, and markup escaped is markup destroyed.
//
// What keeps it honest is not what it does but WHERE IT MAY BE DECLARED: in a
// layout's manifest, never an element's. An element's slots are filled from
// stored state — from what a user typed — while a layout's are filled by
// `generate` with its own output, and by nothing else. The compiler enforces
// that (scripts/block-builder/component-checks.js); this comment does not.
const MARKUP = 'MARKUP';

// What a CSS value may be made of: words, numbers, units, commas, `#` and
// single quotes — enough for a font stack or a percentage. An allow-list
// rather than a list of what to refuse: no `;` or `}` to end the declaration,
// no `(` to call a function, no `\` for a CSS escape, no `"` or `&` to end or
// rewrite the attribute the value sits in.
const CSS_VALUE_CHARS = /^[a-z0-9\s,.'%#_-]+$/i;

// `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, or a bare CSS colour keyword.
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

/**
 * Escapes a value for the place it is about to land in.
 *
 * Refused values become an empty string — or, for a colour or a size, the
 * fallback the template declared. Never a throw: a generator that throws on a
 * value the user typed takes the whole canvas down with it.
 *
 * @param {*} value
 * @param {string} context one of TEXT, ATTR, URL, COLOR, PX, CSS_VALUE, RICH_TEXT
 * @param {*} [fallback] used when the value is refused
 * @returns {string}
 */
function escapeForContext(value, context, fallback) {
  const raw = asString(value);

  switch (context) {
    case TEXT:
      return escapeText(raw);

    case ATTR:
      return escapeAttribute(raw);

    case RICH_TEXT:
      return sanitizeRichText(raw);

    // Passed through, as built. Tested on `value` and not on `raw`: everything
    // reaching this function has already been coerced to a string, so a number
    // or an object would arrive as "42" or "[object Object]" and be written
    // into a cell. Only something that WAS markup is markup.
    case MARKUP:
      return typeof value === 'string' ? value : '';

    case URL:
      return isSafeUrl(raw) ? escapeAttribute(raw.trim()) : asString(fallback);

    case COLOR:
      return COLOR_VALUE.test(raw.trim()) ? raw.trim() : asString(fallback);

    case PX: {
      const number = Number.parseInt(raw, 10);
      return Number.isFinite(number) ? String(number) : asString(fallback);
    }

    case CSS_VALUE: {
      const trimmed = raw.trim();
      // Escaped anyway: every CSS_VALUE slot sits inside an attribute.
      return CSS_VALUE_CHARS.test(trimmed)
        ? escapeAttribute(trimmed)
        : asString(fallback);
    }

    default:
      // An unknown context is a template bug. Escaping as an attribute is the
      // strictest option, so the mistake shows up as over-escaped output rather
      // than as an injection.
      return escapeAttribute(raw);
  }
}

// Every context, for whoever needs the list rather than one of them: the
// template engine, which refuses any other, and the tests.
const CONTEXTS = [TEXT, ATTR, URL, COLOR, PX, CSS_VALUE, RICH_TEXT, MARKUP];

module.exports = {
  CONTEXTS,
  escapeForContext,
  isSafeUrl,
  TEXT,
  ATTR,
  URL,
  COLOR,
  PX,
  CSS_VALUE,
  RICH_TEXT,
  MARKUP,
};
