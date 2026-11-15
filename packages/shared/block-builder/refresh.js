'use strict';

// A saved composed block, brought to the current generator before it is
// inserted (ADR 0027).
//
// The server regenerates any composed block new to an email at its first save
// (mailing/builder-block-integrity.js). A block from the library is always new
// to the email it is dropped into, so it was always going to be rebuilt — but
// silently, after the canvas had shown what an earlier generator wrote, and
// with a stored version still naming that earlier generator. Rebuilding it
// here, with the same generator, is what makes the canvas show what will be
// stored, and the first save find nothing to change.
//
// The shape is never touched: `parseState` keeps a flat composition flat and a
// row-shaped one row-shaped, and `serialiseState` writes back what it was
// handed. Only the generator moves.

const { generate } = require('./generate.js');
const { parseState, serialiseState } = require('./state.js');

/**
 * @param {{builderState: string, builderHtml: string}} pair a stored composed
 *   block's state and markup
 * @returns {{builderState: string, builderHtml: string}} the same pair rebuilt
 *   by the current generator, or the pair as it was when there is nothing to
 *   rebuild from — the server then judges it at the save, as it always has
 */
function refreshForInsertion(pair) {
  const state = parseState(pair.builderState);
  if (!state) return pair;

  return {
    builderState: serialiseState(state),
    builderHtml: generate(state),
  };
}

module.exports = { refreshForInsertion };
