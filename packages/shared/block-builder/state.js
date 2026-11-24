'use strict';

// Reads and writes the builder state stored on a block.
//
// Serialised to a string rather than stored as an object: Mosaico's checkModel
// walks stored content property by property, and a nested object invites it to
// walk into a shape that is none of its business. A string is opaque, and the
// type comparison is short-circuited against the `null` every property is
// generated with (see tests/editor/block-builder/builder-state-survives).
//
// Two stored shapes, one in memory. Version 1 stores a flat list of
// `elements`; version 2 stores `rows` of columns. In memory a composition is
// always rows (see composition.js), and it is written back in the oldest shape
// that holds it: a flat composition as version 1, anything else as version 2.
// A block that never used columns therefore stays readable by a version from
// before them, and a rollback only loses what it could not have shown anyway.
//
// Everything here treats the stored value as HOSTILE. It has been in a database
// for months, written by an older version, possibly hand-edited, possibly
// truncated. Returning null on anything unexpected costs the user a composition
// they have to redo; throwing costs them the editor.

const {
  newElementId,
  cleanAgainst,
  cleanElement,
  ensureUniqueIds,
} = require('./stored-elements.js');
const {
  readRows,
  elementsOf,
  isFlatComposition,
  singleColumnElements,
} = require('./composition.js');
const {
  STATE_VERSION,
  GENERATOR_VERSION,
  DEFAULT_BLOCK,
} = require('./generate.js');

// The version that stores a flat `elements` list.
const FLAT_VERSION = 1;

/**
 * The shape a composition is stored in: `{ v: 1, elements }` for a flat one,
 * or for one without any row, and `{ v: 2, rows }` for anything else.
 *
 * @param {Object} state
 * @returns {Object}
 */
function storedShapeOf(state) {
  const rows = Array.isArray(state.rows) ? state.rows : [];
  if (rows.length === 0 || isFlatComposition(state)) {
    return {
      v: FLAT_VERSION,
      elements: rows.length === 0 ? [] : singleColumnElements(state),
    };
  }
  return { v: STATE_VERSION, rows };
}

/**
 * @param {Object} state
 * @returns {string}
 */
function serialiseState(state) {
  try {
    const source = state || {};
    const { v, ...shape } = storedShapeOf(source);
    return JSON.stringify({
      v,
      // Stamped with the CURRENT generator: what is serialised is what is being
      // applied, and applying regenerates the markup with this version.
      gen: GENERATOR_VERSION,
      block: source.block,
      ...shape,
    });
  } catch (error) {
    // A cycle, or something unserialisable. Storing nothing is better than
    // storing half a state that would reopen as nonsense.
    return '';
  }
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

const UNREADABLE = Object.freeze({ state: null, empty: false });
const EMPTY = Object.freeze({ state: null, empty: true });

/**
 * The stored string, read once: the state it holds, or why there is none.
 *
 * `empty` tells the two reasons apart. An empty composition is what the editor
 * stores when everything was removed and applied: an empty block, which
 * generates no markup. Anything else without a state is unreadable — corrupt,
 * from a later version, or over the limits — and must not be rebuilt into
 * nothing.
 *
 * @param {*} serialised the stored string
 * @returns {{ state: Object|null, empty: boolean }}
 */
function readState(serialised) {
  const parsed = readEnvelope(serialised);
  if (!parsed) return UNREADABLE;

  const rows = readRows(parsed);
  if (rows === null) return UNREADABLE;

  const elements = elementsOf(rows);
  if (elements.length === 0) return EMPTY;
  // Unique across the WHOLE composition, not column by column: selection and
  // drag address an element by id alone, so two elements sharing one in
  // different columns would select and move as one.
  ensureUniqueIds(elements, newElementId);

  return {
    state: {
      v: STATE_VERSION,
      // The generator that wrote the stored markup, kept as read: it is how a
      // reopened block tells that applying would rebuild it differently.
      gen: typeof parsed.gen === 'string' ? parsed.gen : GENERATOR_VERSION,
      block: cleanAgainst(parsed.block, DEFAULT_BLOCK),
      rows,
    },
    empty: false,
  };
}

/**
 * @param {*} serialised the stored string
 * @returns {Object|null} a usable state, or null when there is nothing to reopen
 */
const parseState = (serialised) => readState(serialised).state;

/**
 * Whether the stored string is a composition without any element. parseState
 * returns null for it as for a state it cannot read; see readState.
 *
 * @param {*} serialised the stored string
 * @returns {boolean}
 */
const isEmptyComposition = (serialised) => readState(serialised).empty;

module.exports = {
  serialiseState,
  readState,
  parseState,
  isEmptyComposition,
  cleanElement,
  newElementId,
};
