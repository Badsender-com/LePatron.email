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
const { STATE_VERSION, emptyState } = require('./generate.js');

/**
 * @param {Object} state
 * @returns {string}
 */
function serialiseState(state) {
  try {
    return JSON.stringify({ ...state, v: STATE_VERSION });
  } catch (error) {
    // A cycle, or something unserialisable. Storing nothing is better than
    // storing half a state that would reopen as nonsense.
    return '';
  }
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

  const clean = { id: String(element.id || ''), type: element.type };
  Object.keys(definition.defaults).forEach((key) => {
    clean[key] = Object.prototype.hasOwnProperty.call(element, key)
      ? element[key]
      : definition.defaults[key];
  });

  return clean;
}

/**
 * @param {*} serialised the stored string
 * @returns {Object|null} a usable state, or null when there is nothing to reopen
 */
function parseState(serialised) {
  if (typeof serialised !== 'string' || serialised.trim() === '') return null;

  let parsed;
  try {
    parsed = JSON.parse(serialised);
  } catch (error) {
    return null;
  }

  if (!parsed || typeof parsed !== 'object') return null;
  if (!Array.isArray(parsed.elements)) return null;

  // A state from a FUTURE version: its elements may mean something else
  // entirely. Reopening it would silently rewrite the block on the next save,
  // so it is treated as nothing to reopen.
  if (typeof parsed.v === 'number' && parsed.v > STATE_VERSION) return null;

  const elements = parsed.elements.map(cleanElement).filter(Boolean);
  if (elements.length === 0) return null;

  const base = emptyState();

  return {
    ...base,
    block: { ...base.block, ...(parsed.block || {}) },
    elements,
  };
}

module.exports = { serialiseState, parseState, cleanElement };
