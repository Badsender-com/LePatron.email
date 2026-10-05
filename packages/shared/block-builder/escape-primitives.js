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

// Any scheme at all. A URL that has one is judged on it and nothing else, so
// a token further down the value cannot vouch for what it starts with.
const ANY_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

// What a browser ignores while it reads a scheme: control characters and
// whitespace. Removed before looking for one, so the scheme is judged as the
// browser will read it.
// eslint-disable-next-line no-control-regex -- matching them is the point
const IGNORED_IN_SCHEME = /[\u0000- \u007f]/g;

// ESP personalisation, which is a URL the provider fills in later. Same three
// families the editor already accepts (badsender-extensions.js). Only at the
// START of the value: that is where the provider puts the URL it fills in.
const ESP_TOKEN = /^(<%|\{\{|%%|\[)/;

// A relative path, for assets served alongside the email. Not `//host` nor
// `/\host`, which browsers read as a URL on another host.
const RELATIVE_URL = /^(\.{0,2}\/(?![/\\])|[#?])/;

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

  const compact = trimmed.replace(IGNORED_IN_SCHEME, '');
  if (ANY_SCHEME.test(compact)) return SAFE_URL_SCHEME.test(compact);

  return ESP_TOKEN.test(trimmed) || RELATIVE_URL.test(trimmed);
}

module.exports = { asString, escapeText, escapeAttribute, isSafeUrl };
