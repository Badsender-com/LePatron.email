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

const TEXT = 'TEXT';
const ATTR = 'ATTR';
const URL = 'URL';
const COLOR = 'COLOR';
const PX = 'PX';
const CSS_VALUE = 'CSS_VALUE';

// `&` first, or it would double-escape what the later replacements introduce.
const TEXT_ENTITIES = [
  [/&/g, '&amp;'],
  [/</g, '&lt;'],
  [/>/g, '&gt;'],
];

// Inside an attribute, quotes end it early — which is how a value becomes a new
// attribute, and a new attribute becomes an event handler.
const ATTR_ENTITIES = TEXT_ENTITIES.concat([
  [/"/g, '&quot;'],
  [/'/g, '&#39;'],
]);

// What may open a URL. `javascript:` and `data:` are absent on purpose: the
// first executes, and the second carries a whole document.
const SAFE_URL_SCHEME = /^(https?:|mailto:|tel:)/i;

// ESP personalisation, which is a URL the provider fills in later. Same three
// families the editor already accepts (badsender-extensions.js): `<% %>`,
// `{{ }}`, `%% %%`, plus the `[unsubscribe]` style of bracketed token.
const ESP_TOKEN = /(<%|\{\{|%%|^\[)/;

// A relative path, for assets served alongside the email.
const RELATIVE_URL = /^[./#?]/;

// CSS values may not end a declaration, close the block, or open a new tag —
// nor call `url()` or `expression()`, which load and execute.
const UNSAFE_CSS = /[;}<>]|url\s*\(|expression\s*\(|@import/i;

// `#rgb`, `#rrggbb`, `rgb()`, `rgba()`, or a bare CSS colour keyword.
const COLOR_VALUE = /^(#[0-9a-f]{3,8}|rgba?\([\d\s.,%]+\)|[a-z]+)$/i;

/**
 * @param {*} value
 * @returns {string}
 */
function asString(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}

/**
 * @param {string} value
 * @param {Array} replacements
 * @returns {string}
 */
function applyEntities(value, replacements) {
  return replacements.reduce(
    (escaped, [pattern, entity]) => escaped.replace(pattern, entity),
    value
  );
}

/**
 * Whether a URL may be emitted as written.
 *
 * @param {string} url
 * @returns {boolean}
 */
function isSafeUrl(url) {
  const trimmed = url.trim();
  if (trimmed === '') return false;
  return (
    SAFE_URL_SCHEME.test(trimmed) ||
    ESP_TOKEN.test(trimmed) ||
    RELATIVE_URL.test(trimmed)
  );
}

/**
 * Escapes a value for the place it is about to land in.
 *
 * Refused values become an empty string — or, for a colour or a size, the
 * fallback the template declared. Never a throw: a generator that throws on a
 * value the user typed takes the whole canvas down with it.
 *
 * @param {*} value
 * @param {string} context one of TEXT, ATTR, URL, COLOR, PX, CSS_VALUE
 * @param {*} [fallback] used when the value is refused
 * @returns {string}
 */
function escapeForContext(value, context, fallback) {
  const raw = asString(value);

  switch (context) {
    case TEXT:
      return applyEntities(raw, TEXT_ENTITIES);

    case ATTR:
      return applyEntities(raw, ATTR_ENTITIES);

    case URL:
      return isSafeUrl(raw)
        ? applyEntities(raw.trim(), ATTR_ENTITIES)
        : asString(fallback);

    case COLOR:
      return COLOR_VALUE.test(raw.trim()) ? raw.trim() : asString(fallback);

    case PX: {
      const number = Number.parseInt(raw, 10);
      return Number.isFinite(number) ? String(number) : asString(fallback);
    }

    case CSS_VALUE:
      return UNSAFE_CSS.test(raw) ? asString(fallback) : raw.trim();

    default:
      // An unknown context is a template bug. Escaping as an attribute is the
      // strictest option, so the mistake shows up as over-escaped output rather
      // than as an injection.
      return applyEntities(raw, ATTR_ENTITIES);
  }
}

module.exports = {
  escapeForContext,
  isSafeUrl,
  TEXT,
  ATTR,
  URL,
  COLOR,
  PX,
  CSS_VALUE,
};
