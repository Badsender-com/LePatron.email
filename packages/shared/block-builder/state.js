'use strict';

// Reads and writes the builder state stored on a block.
//
// Serialised to a string rather than stored as an object: Mosaico's checkModel
// walks stored content property by property, and a nested object invites it to
// walk into a shape that is none of its business. A string is opaque, and the
// type comparison is short-circuited against the `null` every property is
// generated with (see tests/editor/block-builder/builder-state-survives).
//
// Everything here treats the stored value as HOSTILE. It has been in a database
// for months, written by an older version, possibly hand-edited, possibly
// truncated. Returning null on anything unexpected costs the user a composition
// they have to redo; throwing costs them the editor.

const { elementFor } = require('./elements/index.js');
const {
  readRows,
  elementsOf,
  ensureUniqueRowIds,
  newRowId,
} = require('./composition.js');
const {
  STATE_VERSION,
  GENERATOR_VERSION,
  DEFAULT_BLOCK,
  emptyState,
} = require('./generate.js');

let sequence = 0;

/**
 * A fresh element id: unique within a session, and unlike any stored one
 * written in an earlier session.
 *
 * @returns {string}
 */
function newElementId() {
  sequence += 1;
  return `el-${Date.now().toString(36)}-${sequence}`;
}

/**
 * @param {Object} state
 * @returns {string}
 */
function serialiseState(state) {
  try {
    // Stamped with the CURRENT generator: what is serialised is what is being
    // applied, and applying regenerates the markup with this version.
    // `elements` is dropped when there are rows: it is a derived view, and
    // storing it beside the rows would be a second source of truth that drifts
    // the first time one is edited and the other is not.
    const { elements, ...rest } = state || {};
    // Which shape gets written, while both exist.
    //
    // Rows are stored only when the caller hands rows and NOTHING ELSE. That is
    // the transitional rule, and it is deliberately unambiguous: `parseState`
    // returns a flat `elements` view beside the rows, and whoever holds that
    // view may be editing it — the modal splices it today. Two shapes in one
    // object, one of them edited, is a composition that disagrees with itself,
    // and the half that loses is whichever the writer did not touch.
    //
    // So: a caller that still thinks in elements writes elements, a caller that
    // thinks in rows writes rows. The rule goes away with the derived view,
    // when the modal composes rows directly.
    const hasRows = Array.isArray(rest.rows) && rest.rows.length > 0;
    const stored =
      hasRows && elements === undefined
        ? rest
        : { ...rest, rows: undefined, elements: elements || [] };

    return JSON.stringify({
      ...stored,
      v: STATE_VERSION,
      gen: GENERATOR_VERSION,
    });
  } catch (error) {
    // A cycle, or something unserialisable. Storing nothing is better than
    // storing half a state that would reopen as nonsense.
    return '';
  }
}

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

/** Cleans a list of stored elements, dropping the ones no template declares. */
const cleanElements = (elements) => elements.map(cleanElement).filter(Boolean);

/**
 * Gives a fresh id to every element whose id is missing or already taken.
 *
 * The id is what the list, the selection and the preview all key on: two
 * elements sharing one select, move and render as one.
 *
 * @param {Array<Object>} elements cleaned elements, modified in place
 * @returns {Array<Object>}
 */
function ensureUniqueIds(elements) {
  const seen = new Set();
  elements.forEach((element) => {
    if (element.id === '' || seen.has(element.id)) element.id = newElementId();
    seen.add(element.id);
  });
  return elements;
}

/**
 * The stored string as a state-shaped object of a version this code reads, or
 * null.
 *
 * @param {*} serialised
 * @returns {Object|null}
 */
function readEnvelope(serialised) {
  if (typeof serialised !== 'string' || serialised.trim() === '') return null;

  let parsed;
  try {
    parsed = JSON.parse(serialised);
  } catch (error) {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  // Either shape: `rows` since columns, a flat `elements` before them. Anything
  // with neither is not a composition this code wrote.
  if (!Array.isArray(parsed.rows) && !Array.isArray(parsed.elements)) {
    return null;
  }

  // A state from a FUTURE version: its elements may mean something else
  // entirely. Reopening it would silently rewrite the block on the next save,
  // so it is treated as nothing to reopen.
  if (typeof parsed.v === 'number' && parsed.v > STATE_VERSION) return null;

  return parsed;
}

/**
 * Whether the stored string is a composition without any element — what the
 * editor stores when everything was removed and applied. parseState returns
 * null for it as for a state it cannot read, but this one means something: an
 * empty block, which generates no markup.
 *
 * @param {*} serialised the stored string
 * @returns {boolean}
 */
function isEmptyComposition(serialised) {
  const parsed = readEnvelope(serialised);
  if (parsed === null) return false;
  return elementsOf(readRows(parsed, cleanElements)).length === 0;
}

/**
 * @param {*} serialised the stored string
 * @returns {Object|null} a usable state, or null when there is nothing to reopen
 */
function parseState(serialised) {
  const parsed = readEnvelope(serialised);
  if (!parsed) return null;

  const rows = readRows(parsed, cleanElements);
  if (elementsOf(rows).length === 0) return null;

  // Ids are made unique across the WHOLE composition, not column by column:
  // selection and drag address an element by id alone, so two elements sharing
  // one in different columns would select and move as one.
  ensureUniqueIds(elementsOf(rows));
  ensureUniqueRowIds(rows, newRowId);

  return {
    ...emptyState(),
    // The generator that wrote the stored markup, kept as read: it is how a
    // reopened block tells that applying would rebuild it differently.
    gen: typeof parsed.gen === 'string' ? parsed.gen : GENERATOR_VERSION,
    block: cleanAgainst(parsed.block, DEFAULT_BLOCK),
    rows,
    // A flat view, in document order, present ONLY for a composition that was
    // stored flat. Its absence is what tells the generator to render rows.
    //
    // That is the rule, and it is one rule: a composition renders the way it
    // was stored. Deriving a flat view for every composition looked tidier and
    // was wrong — a block stored before columns would have come back as a
    // one-column row and re-rendered as a column cell, so translating a mailing
    // without changing a word would have rewritten its markup.
    //
    // It goes away with the ticket that teaches the modal to compose rows.
    ...(Array.isArray(parsed.rows) ? {} : { elements: elementsOf(rows) }),
  };
}

module.exports = {
  serialiseState,
  parseState,
  isEmptyComposition,
  cleanElement,
  newElementId,
};
