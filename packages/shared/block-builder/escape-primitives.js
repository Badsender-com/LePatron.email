'use strict';

// The three escapes everything else is built on.
//
// Split out of slot-contexts.js so the rich text sanitiser can use them without
// importing the context table — which imports the sanitiser. One small module
// at the bottom breaks that cycle, and keeps the escaping itself in one place.

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
// families the editor already accepts (badsender-extensions.js).
const ESP_TOKEN = /(<%|\{\{|%%|^\[)/;

// A relative path, for assets served alongside the email.
const RELATIVE_URL = /^[./#?]/;

/**
 * @param {*} value
 * @returns {string}
 */
function asString(value) {
  if (value === null || typeof value === 'undefined') return '';
  return String(value);
}

function applyEntities(value, replacements) {
  return replacements.reduce(
    (escaped, [pattern, entity]) => escaped.replace(pattern, entity),
    value
  );
}

/**
 * @param {*} value
 * @returns {string}
 */
function escapeText(value) {
  return applyEntities(asString(value), TEXT_ENTITIES);
}

/**
 * @param {*} value
 * @returns {string}
 */
function escapeAttribute(value) {
  return applyEntities(asString(value), ATTR_ENTITIES);
}

/**
 * Whether a URL may be emitted as written.
 *
 * @param {*} url
 * @returns {boolean}
 */
function isSafeUrl(url) {
  const trimmed = asString(url).trim();
  if (trimmed === '') return false;
  return (
    SAFE_URL_SCHEME.test(trimmed) ||
    ESP_TOKEN.test(trimmed) ||
    RELATIVE_URL.test(trimmed)
  );
}

module.exports = { asString, escapeText, escapeAttribute, isSafeUrl };
