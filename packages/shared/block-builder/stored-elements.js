'use strict';

// Bringing stored elements back to what their templates declare, and the ids
// every part of a composition is addressed by.
//
// The lowest level of reading a composition: state.js and composition.js both
// build on it, and it depends on neither. Everything here treats what it is
// given as HOSTILE — it has been in a database for months, written by an older
// version, possibly hand-edited, possibly truncated.

const { elementFor } = require('./elements/index.js');

let sequence = 0;

/**
 * A fresh id: unique within a session, and unlike any stored one written in an
 * earlier session.
 *
 * @param {string} prefix what the id is for
 * @returns {string}
 */
function freshId(prefix) {
  sequence += 1;
  return `${prefix}-${Date.now().toString(36)}-${sequence}`;
}

/** @returns {string} a fresh element id */
const newElementId = () => freshId('el');

/** @returns {string} a fresh row id */
const newRowId = () => freshId('row');

/**
 * A stored value brought back to the type of its default, or the default.
 *
 * The templates format what they are given — a number `label` breaks the
 * modal's `slice`, a string `fontSize` lands in arithmetic. Every default is a
 * string or a number, so those are the only two conversions.
 *
 * @param {*} value
 * @param {string|number} fallback
 * @returns {string|number}
 */
function coerce(value, fallback) {
  if (typeof fallback === 'number') {
    const number = typeof value === 'string' ? Number(value) : value;
    const usable =
      typeof number === 'number' &&
      Number.isFinite(number) &&
      !(typeof value === 'string' && value.trim() === '');
    return usable ? number : fallback;
  }
  if (typeof value === 'string') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
}

/**
 * Keeps the keys `defaults` declares, each coerced to the type of its default,
 * and drops the rest.
 *
 * @param {Object} stored
 * @param {Object} defaults
 * @returns {Object}
 */
function cleanAgainst(stored, defaults) {
  const source = stored && typeof stored === 'object' ? stored : {};
  return Object.keys(defaults).reduce((clean, key) => {
    clean[key] = Object.prototype.hasOwnProperty.call(source, key)
      ? coerce(source[key], defaults[key])
      : defaults[key];
    return clean;
  }, {});
}

/**
 * Keeps the keys an element's template actually declares, dropping the rest.
 *
 * A stored element may carry settings from a newer version, or leftovers from a
 * type it no longer is. Those would ride along invisibly and be written back on
 * the next save.
 *
 * @param {Object} element
 * @returns {Object|null}
 */
function cleanElement(element) {
  if (!element || typeof element !== 'object') return null;

  const definition = elementFor(element.type);
  if (!definition) return null;

  return {
    id: typeof element.id === 'string' ? element.id : '',
    type: element.type,
    ...cleanAgainst(element, definition.defaults),
  };
}

/**
 * Cleans a list of stored elements, dropping the ones no template declares.
 *
 * @param {Array<*>} elements
 * @returns {Array<Object>}
 */
const cleanElements = (elements) => elements.map(cleanElement).filter(Boolean);

/**
 * Gives a fresh id to every item whose id is missing or already taken.
 *
 * The id is what the list, the selection and the preview all key on: two
 * elements, or two rows, sharing one select, move and render as one.
 *
 * @param {Array<Object>} items modified in place
 * @param {Function} makeId () => a fresh id
 * @returns {Array<Object>}
 */
function ensureUniqueIds(items, makeId) {
  const seen = new Set();
  items.forEach((item) => {
    if (item.id === '' || seen.has(item.id)) item.id = makeId();
    seen.add(item.id);
  });
  return items;
}

module.exports = {
  newElementId,
  newRowId,
  cleanAgainst,
  cleanElement,
  cleanElements,
  ensureUniqueIds,
};
